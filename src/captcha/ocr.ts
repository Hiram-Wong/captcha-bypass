import fs from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ModelMessage } from 'ai';
import { Jimp } from 'jimp';
import { Tensor } from 'onnxruntime-web';

import { config } from '@/config';
import { toMath } from '@/utils/format';
import { log } from '@/utils/logger';
import { ROOT_PATH } from '@/utils/path';

import { AiCaptchaService } from './base/ai';
import { BaseOrtservice } from './base/ort';

interface MathResult {
  formula: string;
  result: number;
}

interface TextResult {
  code: string;
}

export type OcrResult = MathResult | TextResult;

const logger = log.withContext('MODULE<ocr>');

class OcrAiCaptchaService extends AiCaptchaService {
  private static instance: OcrAiCaptchaService | null = null;

  public static getInstance(): OcrAiCaptchaService {
    if (!OcrAiCaptchaService.instance) {
      OcrAiCaptchaService.instance = new OcrAiCaptchaService();
    }
    return OcrAiCaptchaService.instance;
  }

  private buildMessages(bgBase64: string, ranges?: Set<string>): ModelMessage[] {
    const allowedCharset =
      ranges && ranges.size > 0
        ? Array.from(ranges)
            .map((c) => `"${c}"`)
            .join(', ')
        : '';
    const prompt = `提取文字${allowedCharset.length ? `，仅允许使用以下字符：${allowedCharset}。` : ''}`;

    return [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image: bgBase64 },
        ],
      },
    ];
  }

  private get options() {
    return {
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseURL,
      model: config.openai.ocrModel,
    };
  }

  public async text(bgBase64: string, ranges?: Set<string>): Promise<TextResult> {
    const messages = this.buildMessages(bgBase64, ranges);
    const options = this.options;

    const text = await this.chatText(messages, options);
    logger.debug(`raw ai completion: ${text}`);

    return { code: text };
  }

  public async math(bgBase64: string, ranges?: Set<string>): Promise<{ formula: string; result: number }> {
    const defaultRanges = new Set([
      ...'0123456789',
      ...'①②③④⑤⑥⑦⑧⑨',
      ...'零一二三四五六七八九',
      ...'〇壹贰叁肆伍陆柒捌玖',
      ...'加减乘除等',
      ...'+-*x÷/=?',
    ]);
    const limit = ranges && ranges.size > 0 ? ranges : defaultRanges;

    const { code } = await this.text(bgBase64, limit);

    let formula = code
      .normalize('NFKC') // 规范化字符格式

      // latex 包裹处理
      .replace(/\$\$(.*?)\$\$/gs, '$1')
      .replace(/\\\[(.*?)\\\]/gs, '$1')
      .replace(/\\\((.*?)\\\)/gs, '$1')

      // latex boxed处理
      .replace(/\\boxed\{([^{}]*)\}/g, '$1')
      .replace(/\\boxed/g, '')

      // latex 运算符处理
      .replace(/\\times/g, '*')
      .replace(/\\cdot/g, '*')
      .replace(/\\div/g, '/')

      .replace(/\{([^{}]*)\}/g, '$1'); // 轻量解包
    formula = toMath(formula);
    if (!formula) throw new Error('Formula expression error');

    let result: unknown;
    try {
      result = Function(`"use strict"; return (${formula})`)();

      if (typeof result !== 'number' || Number.isNaN(result)) {
        throw new Error('Invalid formula expression result');
      }
    } catch {
      throw new Error('Invalid formula expression');
    }

    return { formula, result };
  }
}

const ocrAiCaptchaService = OcrAiCaptchaService.getInstance();

class OcrOrtCaptchaService extends BaseOrtservice {
  private static instance: OcrOrtCaptchaService | null = null;
  private charsetRanges: Set<string> = new Set<string>();

  public static getInstance(): OcrOrtCaptchaService {
    if (!OcrOrtCaptchaService.instance) {
      OcrOrtCaptchaService.instance = new OcrOrtCaptchaService();
    }
    return OcrOrtCaptchaService.instance;
  }

  public async init(): Promise<void> {
    const modelPath = resolve(ROOT_PATH, config.ocr.modelPath);
    const charsetPath = resolve(ROOT_PATH, config.ocr.charsetPath);

    try {
      await fs.access(modelPath);
      await fs.access(charsetPath);
    } catch {
      throw new Error('ONNX model or charset file not found');
    }

    // const model = await fs.readFile(modelPath);
    // await this.loadModel(model);
    await this.loadModel(modelPath);

    const charset = await fs.readFile(charsetPath, 'utf-8');
    await this.loadCharset(charset);

    if (config.ocr.charsetRanges) this.setRanges(config.ocr.charsetRanges.split(''));
  }

  private setRanges(ranges: string[]) {
    if (!ranges.length && this.charsetRanges.size > 0) this.charsetRanges.clear();
    else this.charsetRanges = new Set(ranges);
  }

  private async preproc(base64: string): Promise<{
    floatData: Float32Array;
    size: { height: number; width: number };
    rawSize: { height: number; width: number };
  }> {
    const MEAN = 0.5; // [0.485, 0.456, 0.406];
    const STD = 0.5; // [0.229, 0.224, 0.225];
    const TARGET_SIZE = [0, 64];
    const [_TARGET_WIDTH, TARGET_HEIGHT] = TARGET_SIZE;

    const image = await Jimp.read(Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    const { width: rawWidth, height: rawHeight } = image.bitmap;

    const newWidth = Math.max(1, Math.floor(rawWidth * (TARGET_HEIGHT / rawHeight)));
    const newHeight = TARGET_HEIGHT;

    image.resize({ w: newWidth, h: newHeight }); // 缩放
    image.greyscale(); // sRGB gamma-corrected 优于 luminance

    const { data, width, height } = image.bitmap;
    const channelSize = width * height;
    const floatData = new Float32Array(channelSize);

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      floatData[j] = (data[i] / 255.0 - MEAN) / STD; // ddddocr 1.6.1

      // 1.5.5
      // floatData[j] = (data[i] / 255.0 - MEAN[0]) / STD[0];
      // floatData[channelSize + j] = (data[i + 1] / 255.0 - MEAN[1]) / STD[1];
      // floatData[2 * channelSize + j] = (data[i + 2] / 255.0 - MEAN[2]) / STD[2];
    }

    return {
      floatData,
      size: { height, width },
      rawSize: { height: rawHeight, width: rawWidth },
    };
  }

  public async text(bgBase64: string, ranges?: Set<string>): Promise<TextResult> {
    const { floatData, size } = await this.preproc(bgBase64);

    // ONNX 推理
    const { output } = await this.run(new Tensor('float32', floatData, [1, 1, size.height, size.width]));

    const vocab = this.charset;

    // 构建允许字符的索引集合（用于解码时过滤，参考 ddddocr PR #234）
    const allowedSet = (() => {
      if (ranges && ranges.size > 0) return ranges;
      if (this.charsetRanges.size > 0) return this.charsetRanges;
      return null;
    })();

    const allowedIndices = allowedSet
      ? new Set(
          vocab.reduce<number[]>((acc, char, idx) => {
            if (allowedSet.has(char)) acc.push(idx);
            return acc;
          }, []),
        )
      : undefined;

    // CTC 解码（限制在 allowedIndices 范围内 argmax）
    const ctcDecode = this.ctcGreedyDecode(output, vocab, { blankIndex: 0, allowedIndices });
    const text = typeof ctcDecode === 'string' ? ctcDecode : ctcDecode[0];
    logger.debug(`raw ctc decode: ${text}`);

    return { code: text };
  }

  public async math(bgBase64: string, ranges?: Set<string>): Promise<MathResult> {
    const defaultRanges = new Set([
      ...'0123456789',
      ...'①②③④⑤⑥⑦⑧⑨',
      ...'零一二三四五六七八九',
      ...'〇壹贰叁肆伍陆柒捌玖',
      ...'加减乘除等',
      ...'+-*x÷/=?',
    ]);
    const limit = ranges && ranges.size > 0 ? ranges : defaultRanges;

    const { code } = await this.text(bgBase64, limit);

    let formula = code
      .normalize('NFKC') // 规范化字符格式
      .replace(/27$/, '') // =? -> 27（识别错误率高）
      .replace(/7$/, ''); // ? -> 7（识别错误率高）
    formula = toMath(formula);
    if (!formula) throw new Error('Formula expression error');

    let result: unknown;
    try {
      result = Function(`"use strict"; return (${formula})`)();

      if (typeof result !== 'number' || Number.isNaN(result)) {
        throw new Error('Invalid formula expression result');
      }
    } catch {
      throw new Error('Invalid formula expression');
    }

    return { formula, result };
  }
}

const ocrOrtCaptchaService = OcrOrtCaptchaService.getInstance();

export class OcrCaptchaService {
  private static instance: OcrCaptchaService | null = null;

  public static getInstance(): OcrCaptchaService {
    if (!OcrCaptchaService.instance) {
      OcrCaptchaService.instance = new OcrCaptchaService();
    }
    return OcrCaptchaService.instance;
  }

  public async init(): Promise<void> {
    await ocrOrtCaptchaService.init();
  }

  public async text(imgBase64: string, type: 'ai' | 'onnx', ranges?: Set<string>): Promise<TextResult> {
    const handerMap = {
      ai: () => ocrAiCaptchaService.text(imgBase64, ranges),
      onnx: () => ocrOrtCaptchaService.text(imgBase64, ranges),
    };
    const result = await handerMap[type]?.();
    return result;
  }

  public async math(imgBase64: string, type: 'ai' | 'onnx', ranges?: Set<string>): Promise<MathResult> {
    const handerMap = {
      ai: () => ocrAiCaptchaService.math(imgBase64, ranges),
      onnx: () => ocrOrtCaptchaService.math(imgBase64, ranges),
    };
    const result = await handerMap[type]?.();
    return result;
  }
}

export const ocrCaptchaService = OcrCaptchaService.getInstance();
