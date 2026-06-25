import type { MinMaxLoc } from '@techstark/opencv-js';

import { cv, MatManager, BaseCvService } from './base/cv';

export interface SlideResult {
  x: number;
  y: number;
}

export class SlideCaptchaService extends BaseCvService {
  private static instance: SlideCaptchaService | null = null;

  public static getInstance(): SlideCaptchaService {
    if (!SlideCaptchaService.instance) {
      SlideCaptchaService.instance = new SlideCaptchaService();
    }
    return SlideCaptchaService.instance;
  }

  public async match(thumbBase64: string, bgBase64: string): Promise<SlideResult> {
    const mats = new MatManager();

    try {
      const [grayBgMat, grayThumbMat] = await Promise.all([
        mats.wrap(this.b64ImgToGray(bgBase64)),
        mats.wrap(this.b64ImgToGray(thumbBase64)),
      ]);
      if (!grayBgMat || !grayThumbMat) throw new Error('图像加载失败');

      // 高斯模糊
      const blurTarget = mats.add(new cv.Mat());
      const blurBg = mats.add(new cv.Mat());
      cv.GaussianBlur(grayThumbMat, blurTarget, new cv.Size(3, 3), 0);
      cv.GaussianBlur(grayBgMat, blurBg, new cv.Size(3, 3), 0);

      // Canny 边缘
      const edgeTarget = mats.add(new cv.Mat());
      const edgeBg = mats.add(new cv.Mat());
      cv.Canny(blurTarget, edgeTarget, 100, 200);
      cv.Canny(blurBg, edgeBg, 100, 200);

      // 形态学增强
      const kernel = mats.add(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5)));
      cv.dilate(edgeTarget, edgeTarget, kernel, new cv.Point(-1, -1), 2);
      cv.dilate(edgeBg, edgeBg, kernel, new cv.Point(-1, -1), 2);

      // 模板匹配
      const result = mats.add(new cv.Mat());
      cv.matchTemplate(edgeBg, edgeTarget, result, cv.TM_CCOEFF_NORMED);

      const { maxLoc } = (cv.minMaxLoc as any)(result) as MinMaxLoc;
      return { x: maxLoc.x, y: maxLoc.y };
    } finally {
      mats.release();
    }
  }

  public async compare(thumbBase64: string, bgBase64: string): Promise<SlideResult> {
    const mats = new MatManager();

    try {
      const [grayBgMat, grayThumbMat] = await Promise.all([
        mats.wrap(this.b64ImgToGray(bgBase64)),
        mats.wrap(this.b64ImgToGray(thumbBase64)),
      ]);
      if (!grayBgMat || !grayThumbMat) throw new Error('图像加载失败');

      // 差异
      const diff = mats.add(new cv.Mat());
      cv.absdiff(grayThumbMat, grayBgMat, diff);

      // 二值化
      const thresh = mats.add(new cv.Mat());
      cv.threshold(diff, thresh, 50, 255, cv.THRESH_BINARY);

      // 形态学增强
      const kernel = mats.add(cv.Mat.ones(3, 3, cv.CV_8U));
      const morph = mats.add(new cv.Mat());
      cv.morphologyEx(thresh, morph, cv.MORPH_CLOSE, kernel);

      // 找轮廓
      const contours = mats.add(new cv.MatVector());
      const hierarchy = mats.add(new cv.Mat());

      cv.findContours(morph, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let maxArea = 0;
      let best: SlideResult & { width?: number; height?: number } = { x: 0, y: 0 };

      for (let i = 0; i < contours.size(); i++) {
        const cnt = mats.add(contours.get(i));
        const rect = cv.boundingRect(cnt);
        const area = rect.width * rect.height;

        if (area > maxArea) {
          maxArea = area;
          best = rect;
        }
      }

      return { x: best.x, y: best.y };
    } finally {
      mats.release();
    }
  }
}

export const slideCaptchaService = SlideCaptchaService.getInstance();
