import { BaseCvService } from './captcha/base/cv';
import { detectCaptchaService, type DetectResult } from './captcha/detect';
import { ocrCaptchaService, type OcrResult } from './captcha/ocr';
import type { DetectCaptchaInput, OcrCaptchaInput, RotateCaptchaInput, SlideCaptchaInput } from './captcha/schema';
import { rotateCaptchaService, type RotateResult } from './captcha/rotate';
import { slideCaptchaService, type SlideResult } from './captcha/slide';
import { toImageBase64 } from './utils/format';
import { CacheService } from './utils/cache';
import { log } from './utils/logger';

const logger = log.withContext('SERVICE<captcha>');

const onceInit = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const cached = CacheService.get<Promise<T>>(key);
  if (cached) return cached;

  const promise = fn();
  CacheService.set(key, promise);
  return promise;
};

export const initOcrCaptcha = (): Promise<void> => onceInit('ocr', () => ocrCaptchaService.init());
export const initRotateCaptcha = (): Promise<void[]> =>
  onceInit('rotate', () => Promise.all([rotateCaptchaService.init(), BaseCvService.init()]));
export const initSlideCaptcha = (): Promise<void> => onceInit('slide', () => BaseCvService.init());
export const initDetectCaptcha = (): Promise<void> => onceInit('detect', () => detectCaptchaService.init());

export const solveDetectionCaptcha = async (input: DetectCaptchaInput): Promise<DetectResult> => {
  await initDetectCaptcha();

  const { type, bg, thumb } = input;

  let result;
  switch (type) {
    case 'detect': {
      const thumbImgB64 = await toImageBase64(bg);
      result = await detectCaptchaService.detect(thumbImgB64);
      break;
    }
    case 'match': {
      const [thumbImgB64, bgImgB64] = await Promise.all([toImageBase64(thumb!), toImageBase64(bg)]);
      result = await detectCaptchaService.match(thumbImgB64, bgImgB64);
      break;
    }
    default:
      throw new Error('不支持的识别类型');
  }

  logger.debug(`${type} detect 检出 ${result.length} 个目标`);

  return result;
};

export const solveOcrCaptcha = async (input: OcrCaptchaInput): Promise<OcrResult> => {
  await initOcrCaptcha();

  const { type, action = 'onnx', bg, range } = input;
  const bgImgB64 = await toImageBase64(bg);
  const limit = range ? new Set(range.split('')) : undefined;

  let result;
  switch (type) {
    case 'math': {
      result = await ocrCaptchaService.math(bgImgB64, action, limit);
      logger.debug(`${type} ocr 识别结果: ${result.formula} = ${result.result}`);
      break;
    }
    case 'text': {
      result = await ocrCaptchaService.text(bgImgB64, action, limit);
      logger.debug(`${type} ocr 识别结果: ${result.code}`);
      break;
    }
    default:
      throw new Error('不支持的识别类型');
  }

  return result;
};

export const solveRotateCaptcha = async (input: RotateCaptchaInput): Promise<RotateResult> => {
  await initRotateCaptcha();

  const { type, bg, thumb } = input;

  let result;
  switch (type) {
    case 'single': {
      const thumbImgB64 = await toImageBase64(bg);
      result = await rotateCaptchaService.singleRotate(thumbImgB64);
      break;
    }
    case 'nox': {
      const [thumbImgB64, bgImgB64] = await Promise.all([toImageBase64(thumb!), toImageBase64(bg)]);
      result = await rotateCaptchaService.doubleNox(thumbImgB64, bgImgB64);
      break;
    }
    case 'tiktok': {
      const [thumbImgB64, bgImgB64] = await Promise.all([toImageBase64(thumb!), toImageBase64(bg)]);
      result = await rotateCaptchaService.doubleTiktok(thumbImgB64, bgImgB64);
      break;
    }
    default:
      throw new Error('不支持的识别类型');
  }

  logger.debug(`${type} rotate 识别结果: 顺时针-${result.cw}, 逆时针-${result.ccw}`);

  return result;
};

export const solveSlideCaptcha = async (input: SlideCaptchaInput): Promise<SlideResult> => {
  await initSlideCaptcha();

  const { type, bg, thumb } = input;
  const [bgImgB64, thumbImgB64] = await Promise.all([toImageBase64(bg), toImageBase64(thumb)]);

  let result;
  switch (type) {
    case 'match': {
      result = await slideCaptchaService.match(thumbImgB64, bgImgB64);
      break;
    }
    case 'compare': {
      result = await slideCaptchaService.compare(thumbImgB64, bgImgB64);
      break;
    }
    default:
      throw new Error('不支持的识别类型');
  }

  logger.debug(`${type} slide 识别结果: x-${result.x}, y-${result.y}`);

  return result;
};
