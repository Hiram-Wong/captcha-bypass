import { resolve } from 'node:path';

import type { ModelMessage } from 'ai';
import { file } from 'bun';
import { Jimp } from 'jimp';
import { Tensor } from 'onnxruntime-web';

import { config } from '@/config';
import { base64ToMediaType, toMath } from '@/utils/format';
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
    const mediaType = base64ToMediaType(bgBase64);
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
          // { type: 'image', image: bgBase64 }, // <=6.x
          { type: 'file', data: bgBase64, mediaType }, // >=7.x
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

    const [modelExists, charsetExists] = await Promise.all([file(modelPath).exists(), file(charsetPath).exists()]);
    if (!modelExists) throw new Error('OCR model not found');
    if (!charsetExists) throw new Error('OCR charset file not found');

    await this.loadModel(modelPath);

    const charsetText = await file(charsetPath).text();
    this.loadCharset(charsetText);

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
    const { mean, std, shape } = config.ocr;
    const [imgC, imgH, imgW] = shape;

    const image = await Jimp.read(Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    const { width: rawWidth, height: rawHeight } = image.bitmap;

    const ratio = rawWidth / rawHeight;
    const maxWidth = imgW > 0 ? imgW : Math.ceil(imgH * ratio); // 0 表示不限制宽度

    let resizedW: number;
    if (imgW > 0 && Math.ceil(imgH * ratio) > imgW) {
      resizedW = imgW;
    } else {
      resizedW = Math.max(1, Math.ceil(imgH * ratio));
    }

    image.resize({ w: resizedW, h: imgH });
    if (imgC === 1) image.greyscale();

    const { data, width, height } = image.bitmap;

    const channelSize = maxWidth * imgH;
    const floatData = new Float32Array(imgC * channelSize);

    for (let c = 0; c < imgC; c++) {
      const channelOffset = c * channelSize;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = (y * width + x) * 4 + c;
          const dstIdx = channelOffset + y * maxWidth + x;
          floatData[dstIdx] = (data[srcIdx] / 255.0 - mean) / std;
        }
      }
    }

    return {
      floatData,
      size: { height: imgH, width: maxWidth },
      rawSize: { height: rawHeight, width: rawWidth },
    };
  }

  public async text(bgBase64: string, ranges?: Set<string>): Promise<TextResult> {
    const { floatData, size } = await this.preproc(bgBase64);
    const { shape, ctc } = config.ocr;

    const { output } = await this.run(new Tensor('float32', floatData, [1, shape[0], size.height, size.width]));

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
    const ctcDecode = this.ctcGreedyDecode(output, vocab, {
      blankIndex: 0,
      allowedIndices,
      layout: ctc.layout,
    });
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
