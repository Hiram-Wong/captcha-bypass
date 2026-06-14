import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { Jimp } from 'jimp';
import { Tensor } from 'onnxruntime-web';

import { BaseOrtservice } from './base/ort';
import { config } from '@/config';
import { ROOT_PATH } from '@/utils/path';

interface DetectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DetectResultItem {
  target: string;
  coordinate: DetectionBox;
}

export type DetectResult = DetectResultItem[];

export class DetectCaptchaService extends BaseOrtservice {
  private static instance: DetectCaptchaService | null = null;

  static getInstance(): DetectCaptchaService {
    if (!DetectCaptchaService.instance) {
      DetectCaptchaService.instance = new DetectCaptchaService();
    }
    return DetectCaptchaService.instance;
  }

  async init(): Promise<void> {
    const modelPath = resolve(ROOT_PATH, config.detect.modelPath);

    try {
      await fs.access(modelPath);
    } catch {
      throw new Error('Detect model not found');
    }

    // const model = await fs.readFile(modelPath);
    // await this.loadModel(model);
    await this.loadModel(modelPath);
  }

  private async preproc(base64: string): Promise<{
    floatData: Float32Array;
    ratio: number;
    size: { height: number; width: number };
    rawSize: { height: number; width: number };
  }> {
    const TARGET_SIZE = [416, 416];
    const [TARGET_WIDTH, TARGET_HEIGHT] = TARGET_SIZE;

    const image = await Jimp.read(Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    const { width: rawWidth, height: rawHeight } = image.bitmap;

    const ratio = Math.min(TARGET_WIDTH / rawWidth, TARGET_HEIGHT / rawHeight);
    const newWidth = Math.round(rawWidth * ratio);
    const newHeight = Math.round(rawHeight * ratio);

    // 缩放
    image.resize({ w: newWidth, h: newHeight });

    const { data, width, height } = image.bitmap;
    const channelSize = TARGET_WIDTH * TARGET_HEIGHT;
    const floatData = new Float32Array(3 * channelSize);

    // 填充 114（BGR）
    floatData.fill(114);

    // 图像左上角，BGR 通道顺序 (CHW: B=0, G=1, R=2)
    for (let y = 0; y < height; y++) {
      const srcRowStart = y * width * 4;
      const dstRowStart = y * TARGET_WIDTH;

      for (let x = 0; x < width; x++) {
        const srcIdx = srcRowStart + x * 4;
        const dstIdx = dstRowStart + x;

        // Jimp RGBA → ONNX BGR
        floatData[dstIdx] = data[srcIdx + 2]; // B → CHW[0]
        floatData[channelSize + dstIdx] = data[srcIdx + 1]; // G → CHW[1]
        floatData[2 * channelSize + dstIdx] = data[srcIdx]; // R → CHW[2]
      }
    }

    // 计算居中偏移
    // const padLeft = (TARGET_WIDTH - width) >> 1;
    // const padTop = (TARGET_HEIGHT - height) >> 1;

    // 图像居中放置，BGR 通道顺序 (CHW: B=0, G=1, R=2)
    // for (let y = 0; y < height; y++) {
    //   const srcRowStart = y * width * 4;
    //   const dstRowStart = (y + padTop) * TARGET_WIDTH + padLeft;

    //   for (let x = 0; x < width; x++) {
    //     const srcIdx = srcRowStart + x * 4;
    //     const dstIdx = dstRowStart + x;

    //     // Jimp RGBA → ONNX BGR
    //     floatData[dstIdx] = data[srcIdx + 2]; // B → CHW[0]
    //     floatData[channelSize + dstIdx] = data[srcIdx + 1]; // G → CHW[1]
    //     floatData[2 * channelSize + dstIdx] = data[srcIdx]; // R → CHW[2]
    //   }
    // }

    return {
      floatData,
      ratio,
      size: { height: TARGET_HEIGHT, width: TARGET_WIDTH },
      rawSize: { height: rawHeight, width: rawWidth },
    };
  }

  private reprocess(output: number[][][], img_size: [number, number], p6: boolean = false): number[][][] {
    const grids = [];
    const expandedStrides = [];

    // 定义步长
    const strides = p6 ? [8, 16, 32, 64] : [8, 16, 32];

    // 计算每个特征层的网格尺寸
    const hsizes = strides.map((stride) => Math.floor(img_size[0] / stride));
    const wsizes = strides.map((stride) => Math.floor(img_size[1] / stride));

    // 为每个特征层生成网格和步长
    for (let idx = 0; idx < strides.length; idx++) {
      const hsize = hsizes[idx];
      const wsize = wsizes[idx];
      const stride = strides[idx];

      // 生成网格坐标
      const grid = [];
      for (let y = 0; y < hsize; y++) {
        for (let x = 0; x < wsize; x++) {
          grid.push([x, y]);
        }
      }
      grids.push(grid);

      // 生成对应的步长
      const expandedStride = new Array(grid.length).fill([stride]);
      expandedStrides.push(expandedStride);
    }

    // 扁平化所有网格和步长
    const flatGrids = grids.flat();
    const flatExpandedStrides = expandedStrides.flat();

    // 深拷贝输出
    const result = structuredClone(output);

    // 转换坐标
    for (let batch = 0; batch < result.length; batch++) {
      const batchData = result[batch];

      for (let i = 0; i < batchData.length; i++) {
        const grid = flatGrids[i];
        const stride = flatExpandedStrides[i][0];

        if (!grid || !stride) continue;

        // 中心点坐标: (tx + grid_x) * stride
        batchData[i][0] = (batchData[i][0] + grid[0]) * stride;
        batchData[i][1] = (batchData[i][1] + grid[1]) * stride;

        // 宽高: exp(tw) * stride
        batchData[i][2] = Math.exp(batchData[i][2]) * stride;
        batchData[i][3] = Math.exp(batchData[i][3]) * stride;
      }
    }

    return result;
  }

  private nms(boxes: number[][], scores: number[], nmsThr: number): number[] {
    if (boxes.length === 0) return [];

    // 计算每个框的面积
    const areas = boxes.map((box) => (box[2] - box[0] + 1) * (box[3] - box[1] + 1));

    // 按置信度降序排序
    const order = scores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.idx);

    const keep: number[] = [];

    while (order.length > 0) {
      // 保留当前最高分的框
      const i = order[0];
      keep.push(i);

      if (order.length === 1) break;

      const rest = order.slice(1);

      // 计算当前框与其余框的交集
      const xx1 = rest.map((idx) => Math.max(boxes[i][0], boxes[idx][0]));
      const yy1 = rest.map((idx) => Math.max(boxes[i][1], boxes[idx][1]));
      const xx2 = rest.map((idx) => Math.min(boxes[i][2], boxes[idx][2]));
      const yy2 = rest.map((idx) => Math.min(boxes[i][3], boxes[idx][3]));

      // 计算交集的宽高和面积
      const w = xx2.map((v, j) => Math.max(0, v - xx1[j] + 1));
      const h = yy2.map((v, j) => Math.max(0, v - yy1[j] + 1));
      const inter = w.map((v, j) => v * h[j]);

      // 计算 IoU
      const ovr = inter.map((v, j) => v / (areas[i] + areas[rest[j]] - v));

      // 保留 IoU <= 阈值的框
      const newOrder: number[] = [];
      for (let j = 0; j < rest.length; j++) {
        if (ovr[j] <= nmsThr) {
          newOrder.push(rest[j]);
        }
      }
      order.length = 0;
      order.push(...newOrder);
    }

    return keep;
  }

  private multiclassNmsClassAgnostic(
    boxes: number[][],
    scores: number[][],
    nmsThr: number,
    scoreThr: number,
  ): Array<[number, number, number, number, number, number]> {
    if (boxes.length === 0 || scores.length === 0) return [];

    // 获取每个框的最高分和对应类别
    const maxScores: number[] = [];
    const maxClassIds: number[] = [];

    for (let i = 0; i < scores.length; i++) {
      let maxScore = -Infinity;
      let maxClass = -1;
      for (let j = 0; j < scores[i].length; j++) {
        if (scores[i][j] > maxScore) {
          maxScore = scores[i][j];
          maxClass = j;
        }
      }
      maxScores.push(maxScore);
      maxClassIds.push(maxClass);
    }

    // 过滤低分框
    const validBoxes: number[][] = [];
    const validScores: number[] = [];
    const validClasses: number[] = [];

    for (let i = 0; i < maxScores.length; i++) {
      if (maxScores[i] > scoreThr) {
        validBoxes.push(boxes[i]);
        validScores.push(maxScores[i]);
        validClasses.push(maxClassIds[i]);
      }
    }

    if (validBoxes.length === 0) return [];

    // 应用 NMS
    const keep = this.nms(validBoxes, validScores, nmsThr);

    const detections: Array<[number, number, number, number, number, number]> = [];
    for (const idx of keep) {
      const box = validBoxes[idx];
      detections.push([box[0], box[1], box[2], box[3], validScores[idx], validClasses[idx]]);
    }

    return detections;
  }

  private getBbox(
    outputData: Float32Array,
    outputDims: readonly number[],
    imgSize: [number, number],
    ratio: number,
    nmsThr: number = 0.45,
    scoreThr: number = 0.1,
  ): number[][] {
    const [batch, numAnchors, ch] = outputDims;

    // 展平 Float32Array → [batch][anchor][features]
    const reshaped: number[][][] = [];
    for (let b = 0; b < batch; b++) {
      const batchData: number[][] = [];
      const base = b * numAnchors * ch;
      for (let i = 0; i < numAnchors; i++) {
        const start = base + i * ch;
        batchData.push(Array.from(outputData.slice(start, start + ch)));
      }
      reshaped.push(batchData);
    }

    // 锚框解码：raw → 绝对坐标 (cx,cy,w,h)
    const decoded = this.reprocess(reshaped, imgSize);
    const batch0 = decoded[0];

    // 提取 bbox 和 scores (objness[:,4:5] * classes[:,5:])
    const boxes = batch0.map((p) => [p[0], p[1], p[2], p[3]]);
    const scores = batch0.map((p) => {
      const objProb = p[4];
      return p.slice(5).map((classProb: number) => objProb * classProb);
    });

    // 中心+宽高 → xyxy，并反向缩放回原图尺寸
    const boxesXyxy = boxes.map((box) => [
      (box[0] - box[2] / 2) / ratio,
      (box[1] - box[3] / 2) / ratio,
      (box[0] + box[2] / 2) / ratio,
      (box[1] + box[3] / 2) / ratio,
    ]);

    // 多类别 NMS（class-agnostic）
    const detections = this.multiclassNmsClassAgnostic(boxesXyxy, scores, nmsThr, scoreThr);

    return detections.map((d: number[]) => [
      Math.max(0, Math.floor(d[0])),
      Math.max(0, Math.floor(d[1])),
      Math.ceil(d[2]),
      Math.ceil(d[3]),
    ]);
  }

  private hungarian(costMatrix: number[][]): number[] {
    const n = costMatrix.length;
    const m = costMatrix[0]?.length ?? 0;
    if (n === 0 || m === 0) return [];

    const u = new Array<number>(n + 1).fill(0);
    const v = new Array<number>(m + 1).fill(0);
    const p = new Array<number>(m + 1).fill(0);
    const way = new Array<number>(m + 1).fill(0);

    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Array<number>(m + 1).fill(Infinity);
      const used = new Array<boolean>(m + 1).fill(false);

      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity;
        let j1 = 0;

        for (let j = 1; j <= m; j++) {
          if (!used[j]) {
            const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
            if (cur < minv[j]) {
              minv[j] = cur;
              way[j] = j0;
            }
            if (minv[j] < delta) {
              delta = minv[j];
              j1 = j;
            }
          }
        }

        for (let j = 0; j <= m; j++) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }
        j0 = j1;
      } while (p[j0] !== 0);

      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0 !== 0);
    }

    const assignment = new Array<number>(m).fill(-1);
    for (let j = 1; j <= m; j++) {
      if (p[j] !== 0) assignment[j - 1] = p[j] - 1;
    }
    return assignment;
  }

  private boxArea(b: DetectionBox): number {
    return (b.x2 - b.x1) * (b.y2 - b.y1);
  }

  private async cropRegions(base64: string, boxes: DetectionBox[]): Promise<DetectResult> {
    const rawB64 = base64.replace(/^data:image\/\w+;base64,/, '');
    const image = await Jimp.read(Buffer.from(rawB64, 'base64'));

    const results: DetectResult = [];
    for (const box of boxes) {
      const w = box.x2 - box.x1;
      const h = box.y2 - box.y1;
      if (w <= 0 || h <= 0) continue;

      const cropped = image.clone().crop({ x: box.x1, y: box.y1, w, h });
      const croppedB64 = await cropped.getBase64('image/png');

      results.push({
        target: croppedB64,
        coordinate: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 },
      });
    }
    return results;
  }

  private matchBoxes(thumbBoxes: DetectionBox[], bgBoxes: DetectionBox[]): DetectionBox[] {
    const T = thumbBoxes.length;
    const B = bgBoxes.length;
    if (T === 0 || B === 0) return [];

    const n = Math.max(T, B);
    const cost: number[][] = [];

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        if (i < T && j < B) {
          const ta = this.boxArea(thumbBoxes[i]);
          const ba = this.boxArea(bgBoxes[j]);
          const areaCost = ta > 0 && ba > 0 ? Math.abs(ta - ba) / Math.max(ta, ba) : 1;

          const tw = thumbBoxes[i].x2 - thumbBoxes[i].x1;
          const th = thumbBoxes[i].y2 - thumbBoxes[i].y1;
          const bw = bgBoxes[j].x2 - bgBoxes[j].x1;
          const bh = bgBoxes[j].y2 - bgBoxes[j].y1;
          const tr = tw > 0 ? th / tw : 0;
          const br = bw > 0 ? bh / bw : 0;
          const aspectCost = tr > 0 && br > 0 ? Math.abs(tr - br) / Math.max(tr, br) : 1;

          row.push(areaCost + aspectCost);
        } else {
          row.push(Infinity);
        }
      }
      cost.push(row);
    }

    const assignment = this.hungarian(cost);

    const result: DetectionBox[] = [];
    for (let j = 0; j < B; j++) {
      const i = assignment[j];
      if (i >= 0 && i < T) {
        result.push(bgBoxes[j]);
      }
    }
    return result;
  }

  private async detectBoxes(base64: string): Promise<DetectionBox[]> {
    const { floatData, ratio, size, rawSize } = await this.preproc(base64);

    // ONNX 推理
    const { output } = await this.run(new Tensor('float32', floatData, [1, 3, size.height, size.width]));
    const outputData = output.data as Float32Array;

    // 后处理
    const boxes = this.getBbox(outputData, output.dims, [size.height, size.width], ratio);

    // clip 到原图边界
    const xMax = rawSize.width - 1;
    const yMax = rawSize.height - 1;
    return boxes.map((b) => ({
      x1: b[0],
      y1: b[1],
      x2: Math.min(xMax, b[2]),
      y2: Math.min(yMax, b[3]),
    }));
  }

  public async detect(bgBase64: string): Promise<DetectResult> {
    const boxes = await this.detectBoxes(bgBase64);
    return this.cropRegions(bgBase64, boxes);
  }

  public async match(thumbBase64: string, bgBase64: string): Promise<DetectResult> {
    const [thumbBoxes, bgBoxes] = await Promise.all([this.detectBoxes(thumbBase64), this.detectBoxes(bgBase64)]);
    const matched = this.matchBoxes(thumbBoxes, bgBoxes);
    return this.cropRegions(bgBase64, matched);
  }
}

export const detectCaptchaService = DetectCaptchaService.getInstance();
