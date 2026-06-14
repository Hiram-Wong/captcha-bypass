import { Elysia } from 'elysia';

import { authMW } from '@/middleware/auth';
import {
  ocrCaptchaSchema,
  rotateCaptchaSchema,
  slideCaptchaSchema,
  detectCaptchaSchema,
  ocrResponseSchema,
  rotateResponseSchema,
  slideResponseSchema,
  detectResponseSchema,
} from './model';
import { solveOcrCaptcha, solveRotateCaptcha, solveSlideCaptcha, solveDetectionCaptcha } from './service';

export const captchaController = new Elysia({ name: 'captcha/controller' })
  .use(authMW.middleware())
  .post(
    '/captcha/detect',
    async ({ body }) => {
      try {
        const data = await solveDetectionCaptcha(body);
        return { status: 0 as const, data, msg: 'success' };
      } catch (err) {
        console.error('[DETECT] 识别错误:', err);
        return {
          code: -1 as const,
          msg: err instanceof Error ? err.message || '识别失败' : '识别失败',
        };
      }
    },
    {
      body: detectCaptchaSchema,
      response: { 200: detectResponseSchema },
    },
  )
  .post(
    '/captcha/ocr',
    async ({ body }) => {
      try {
        const data = await solveOcrCaptcha(body);
        return { status: 0 as const, data, msg: 'success' };
      } catch (err) {
        console.error('[OCR] 识别错误:', err);
        return {
          code: -1 as const,
          msg: err instanceof Error ? err.message || '识别失败' : '识别失败',
        };
      }
    },
    {
      body: ocrCaptchaSchema,
      response: { 200: ocrResponseSchema },
    },
  )
  .post(
    '/captcha/rotate',
    async ({ body }) => {
      try {
        const data = await solveRotateCaptcha(body);
        return { status: 0 as const, data, msg: 'success' };
      } catch (err) {
        console.error('[ROTATE] 识别错误:', err);
        return {
          code: -1 as const,
          msg: err instanceof Error ? err.message || '识别失败' : '识别失败',
        };
      }
    },
    {
      body: rotateCaptchaSchema,
      response: { 200: rotateResponseSchema },
    },
  )
  .post(
    '/captcha/slide',
    async ({ body }) => {
      try {
        const data = await solveSlideCaptcha(body);
        return { status: 0 as const, data, msg: 'success' };
      } catch (err) {
        console.error('[SLIDE] 识别错误:', err);
        return {
          code: -1 as const,
          msg: err instanceof Error ? err.message || '识别失败' : '识别失败',
        };
      }
    },
    {
      body: slideCaptchaSchema,
      response: { 200: slideResponseSchema },
    },
  );

export default captchaController;
