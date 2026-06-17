import { ocrCaptchaService, type OcrResult } from '@/captcha/ocr';
import { rotateCaptchaService, type RotateResult } from '@/captcha/rotate';
import { slideCaptchaService, type SlideResult } from '@/captcha/slide';
import { detectCaptchaService, type DetectResult } from '@/captcha/detect';
import type {
  OcrCaptchaInput,
  RotateCaptchaInput,
  SlideCaptchaInput,
  DetectCaptchaInput,
} from '@/modules/captcha/model';
import { toImageBase64 } from '@/utils/format';
import { log } from '@/utils/logger';

const logger = log.withContext('SERVICE<captcha>');

export const solveDetectionCaptcha = async (input: DetectCaptchaInput): Promise<DetectResult> => {
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
