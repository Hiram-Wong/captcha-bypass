import { resolve } from 'node:path';

import { file } from 'bun';
import { Jimp } from 'jimp';
import { Tensor } from 'onnxruntime-web';
import type { MinMaxLoc } from '@techstark/opencv-js';

import { config } from '@/config';
import { ROOT_PATH } from '@/utils/path';

import { cv, MatManager, BaseCvService } from './base/cv';
import { BaseOrtservice } from './base/ort';

export type RotateResult = {
  cw: number;
  ccw: number;
};

class RotateOrtCaptchaService extends BaseOrtservice {
  private static instance: RotateOrtCaptchaService | null = null;

  public static getInstance(): RotateOrtCaptchaService {
    if (!RotateOrtCaptchaService.instance) {
      RotateOrtCaptchaService.instance = new RotateOrtCaptchaService();
    }
    return RotateOrtCaptchaService.instance;
  }

  public async init(): Promise<void> {
    const modelPath = resolve(ROOT_PATH, config.rotate.modelPath);

    const modelExists = await file(modelPath).exists();
    if (!modelExists) throw new Error('Rotate model file not found');

    await this.loadModel(modelPath);
  }

  private preproc = async (
    base64: string,
  ): Promise<{
    floatData: Float32Array;
    size: { height: number; width: number };
    rawSize: { height: number; width: number };
  }> => {
    const MEAN = [0.485, 0.456, 0.406];
    const STD = [0.229, 0.224, 0.225];
    const TARGET_SIZE = [224, 224];
    const [TARGET_WIDTH, TARGET_HEIGHT] = TARGET_SIZE;

    const image = await Jimp.read(Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    const { width: rawWidth, height: rawHeight } = image.bitmap;

    // 中心裁剪: size / sqrt(2)
    const outputSize = Math.floor(rawWidth / Math.SQRT2);
    const cropX = Math.floor((rawWidth - outputSize) / 2);
    const cropY = Math.floor((rawHeight - outputSize) / 2);
    image.crop({ x: cropX, y: cropY, w: outputSize, h: outputSize });

    image.resize({ w: TARGET_WIDTH, h: TARGET_HEIGHT }); // 缩放

    const { data, width, height } = image.bitmap;
    const channelSize = width * height;
    const floatData = new Float32Array(3 * channelSize);

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      floatData[j] = (data[i] / 255.0 - MEAN[0]) / STD[0];
      floatData[channelSize + j] = (data[i + 1] / 255.0 - MEAN[1]) / STD[1];
      floatData[2 * channelSize + j] = (data[i + 2] / 255.0 - MEAN[2]) / STD[2];
    }

    return {
      floatData,
      size: { height, width },
      rawSize: { height: rawHeight, width: rawWidth },
    };
  };

  public async singleRotate(bgBase64: string): Promise<RotateResult> {
    const { floatData, size } = await this.preproc(bgBase64);

    // ONNX 推理
    const { output } = await this.run(new Tensor('float32', floatData, [1, 3, size.height, size.width]));
    const outputData = output.data as Float32Array;
    const clsNum = output.dims[output.dims.length - 1];

    // argmax
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < clsNum; i++) {
      if (outputData[i] > maxVal) {
        maxVal = outputData[i];
        maxIdx = i;
      }
    }

    const degree = (maxIdx / clsNum) * 360;
    const cw = Math.round((degree + 360) % 360);

    return { cw, ccw: 360 - cw };
  }
}

const rotateOrtCaptchaService = RotateOrtCaptchaService.getInstance();

class RotateCvCaptchaService extends BaseCvService {
  private static instance: RotateCvCaptchaService | null = null;

  public static getInstance(): RotateCvCaptchaService {
    if (!RotateCvCaptchaService.instance) {
      RotateCvCaptchaService.instance = new RotateCvCaptchaService();
    }
    return RotateCvCaptchaService.instance;
  }

  /**
   * 两级旋转角度搜索
   * @param scoreFn 评分函数, 返回数值
   * @param minimize true=找最小值, false=找最大值
   * @param coarseStep 粗搜索步长 (度)
   * @param fineStep 精搜索步长 (度)
   * @param fineWindow 精搜索窗口 (±粗搜索最佳角度)
   */
  private rotateSearch(
    scoreFn: (angle: number) => number,
    minimize: boolean,
    coarseStep: number = 5,
    fineStep: number = 1,
    fineWindow: number = 5,
  ): { angle: number; score: number } {
    const initialScore = minimize ? Number.MAX_VALUE : Number.NEGATIVE_INFINITY;
    const isBetter = (score: number, best: number) => (minimize ? score < best : score > best);

    let bestAngle = 0;
    let bestScore = initialScore;

    // 粗搜索
    for (let angle = 0; angle < 360; angle += coarseStep) {
      const score = scoreFn(angle);
      if (isBetter(score, bestScore)) {
        bestScore = score;
        bestAngle = angle;
      }
    }

    // 精搜索
    for (let angle = bestAngle - fineWindow; angle <= bestAngle + fineWindow; angle += fineStep) {
      const score = scoreFn(angle);
      if (isBetter(score, bestScore)) {
        bestScore = score;
        bestAngle = angle;
      }
    }

    return { angle: bestAngle, score: bestScore };
  }

  /**
   * nox
   * 双图, 背景图不动, 参考背景图旋转
   */
  public async doubleNox(thumbBase64: string, bgBase64: string): Promise<RotateResult> {
    const mats = new MatManager();

    try {
      const [grayBgMat, grayThumbMat, thumbMask] = await Promise.all([
        mats.wrap(this.b64ImgToGray(bgBase64)),
        mats.wrap(this.b64ImgToGray(thumbBase64)),
        mats.wrap(this.b64ImgToAlphaMask(thumbBase64)),
      ]);
      if (!grayBgMat || !grayThumbMat || !thumbMask) throw new Error('图像加载失败');

      const bgWidth = grayBgMat.cols;
      const bgHeight = grayBgMat.rows;
      const thumbWidth = grayThumbMat.cols;
      const thumbHeight = grayThumbMat.rows;

      const x1 = Math.floor((bgWidth - thumbWidth) / 2);
      const y1 = Math.floor((bgHeight - thumbHeight) / 2);

      const roi = mats.add(grayBgMat.roi(new cv.Rect(x1, y1, thumbWidth, thumbHeight)));

      const { angle: bestAngle, score: bestScore } = this.rotateSearch(
        (angle) => {
          const center = new cv.Point(grayThumbMat.cols / 2, grayThumbMat.rows / 2);
          const M = mats.add(cv.getRotationMatrix2D(center, angle, 1));
          const rotated = mats.add(new cv.Mat());
          const rotatedMask = mats.add(new cv.Mat());
          const size = new cv.Size(grayThumbMat.cols, grayThumbMat.rows);
          const result = mats.add(new cv.Mat());

          cv.warpAffine(grayThumbMat, rotated, M, size, cv.INTER_LINEAR, cv.BORDER_REPLICATE);
          cv.warpAffine(thumbMask, rotatedMask, M, size, cv.INTER_NEAREST, cv.BORDER_CONSTANT, new cv.Scalar(0));
          cv.matchTemplate(roi, rotated, result, cv.TM_CCORR_NORMED, rotatedMask);

          const { maxVal } = (cv.minMaxLoc as any)(result) as MinMaxLoc;
          return maxVal;
        },
        false, // maximize
        5,
        1,
        5,
      );

      if (!Number.isFinite(bestScore)) throw new Error('旋转角度匹配失败');

      const cw = (bestAngle + 360) % 360;

      return { cw, ccw: 360 - cw };
    } finally {
      mats.release();
    }
  }

  /**
   * tiktok
   * 双图(圆), 背景图镂空, 参考背景图旋转
   * @see https://blog.csdn.net/u011931957/article/details/147661195
   */
  public async doubleTiktok(thumbBase64: string, bgBase64: string): Promise<RotateResult> {
    const mats = new MatManager();

    // 采样圆环半径比例 (避免采样到图像边缘外的透明区域)
    const RING_RADIUS_SCALE = 0.85;
    const RING_OFFSETS = [
      [-6, 6],
      [-4, 4],
      [-2, 2],
    ];
    const RING_SAMPLES = 180;

    const precomputeRingPoints = (width: number, height: number, refWidth: number) => {
      const cx = width / 2;
      const cy = height / 2;
      const radius = (Math.min(width, height) / 2) * RING_RADIUS_SCALE;

      const points: Array<{ ix: number; iy: number; ox: number; oy: number }> = [];

      for (const [innerOffset, outerOffset] of RING_OFFSETS) {
        for (let i = 0; i < RING_SAMPLES; i++) {
          const theta = (2 * Math.PI * i) / RING_SAMPLES;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);

          const ix = cx + (radius + innerOffset) * cos;
          const iy = cy + (radius + innerOffset) * sin;
          const ox = cx + (radius + outerOffset) * cos;
          const oy = cy + (radius + outerOffset) * sin;

          if (ix >= 0 && ix < width && iy >= 0 && iy < height && ox >= 0 && ox < width && oy >= 0 && oy < height) {
            points.push({ ix: Math.round(ix), iy: Math.round(iy), ox: Math.round(ox), oy: Math.round(oy) });
          }
        }
      }

      return points;
    };

    try {
      let [bgRGBA, thumbRGBA] = await Promise.all([
        mats.wrap(this.b64ImgToMatRGBA(bgBase64)),
        mats.wrap(this.b64ImgToMatRGBA(thumbBase64)),
      ]);

      if (!bgRGBA || !thumbRGBA) throw new Error('图像加载失败');

      const width = bgRGBA.cols;
      const height = bgRGBA.rows;

      if (thumbRGBA.cols !== width || thumbRGBA.rows !== height) {
        const resized = mats.add(new cv.Mat());
        cv.resize(thumbRGBA, resized, new cv.Size(width, height));
        thumbRGBA = resized;
      }

      const ringPoints = precomputeRingPoints(width, height, width);
      if (ringPoints.length === 0) throw new Error('圆环采样点计算失败');

      const { angle: bestAngle, score: bestScore } = this.rotateSearch(
        (angle) => {
          const w = thumbRGBA.cols;
          const h = thumbRGBA.rows;
          const center = new cv.Point(w / 2, h / 2);
          const M = mats.add(cv.getRotationMatrix2D(center, angle, 1));
          const rotated = mats.add(new cv.Mat());

          cv.warpAffine(
            thumbRGBA,
            rotated,
            M,
            new cv.Size(w, h),
            cv.INTER_LINEAR,
            cv.BORDER_CONSTANT,
            new cv.Scalar(0, 0, 0, 0),
          );

          const rData = rotated.data as Uint8Array;
          const bData = bgRGBA.data as Uint8Array;

          let totalDist = 0;
          let validCount = 0;

          for (const { ix, iy, ox, oy } of ringPoints) {
            const innerIdx = (iy * w + ix) * 4;
            const outerIdx = (oy * w + ox) * 4;

            if (rData[innerIdx + 3] === 0 || bData[outerIdx + 3] === 0) continue;

            const dr = rData[innerIdx] - bData[outerIdx];
            const dg = rData[innerIdx + 1] - bData[outerIdx + 1];
            const db = rData[innerIdx + 2] - bData[outerIdx + 2];

            totalDist += Math.sqrt(dr * dr + dg * dg + db * db);
            validCount++;
          }

          return validCount > 0 ? totalDist / validCount : Number.MAX_VALUE;
        },
        true, // minimize
        2,
        1,
        2,
      );

      if (!Number.isFinite(bestScore)) throw new Error('旋转角度匹配失败');

      const cw = (bestAngle + 360) % 360;

      return { cw, ccw: 360 - cw };
    } finally {
      mats.release();
    }
  }
}

const rotateCvCaptchaService = RotateCvCaptchaService.getInstance();

export class RotateCaptchaService {
  private static instance: RotateCaptchaService | null = null;

  public static getInstance(): RotateCaptchaService {
    if (!RotateCaptchaService.instance) {
      RotateCaptchaService.instance = new RotateCaptchaService();
    }
    return RotateCaptchaService.instance;
  }

  public async init(): Promise<void> {
    await rotateOrtCaptchaService.init();
  }

  public async singleRotate(imgBase64: string): Promise<RotateResult> {
    return rotateOrtCaptchaService.singleRotate(imgBase64);
  }

  public async doubleNox(thumbBase64: string, bgBase64: string): Promise<RotateResult> {
    return rotateCvCaptchaService.doubleNox(thumbBase64, bgBase64);
  }

  public async doubleTiktok(thumbBase64: string, bgBase64: string): Promise<RotateResult> {
    return rotateCvCaptchaService.doubleTiktok(thumbBase64, bgBase64);
  }
}

export const rotateCaptchaService = RotateCaptchaService.getInstance();
