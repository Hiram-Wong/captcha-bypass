import { Elysia } from 'elysia';

import { auth } from '@/middleware/auth';
import { log } from '@/utils/logger';
import { fail, success } from '@/utils/response';

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

const logger = log.withContext('CONTROLLER<captcha>');

export const captchaController = new Elysia({ name: 'captcha' }).group('/captcha', (app) =>
  app
    .use(auth())
    .post(
      '/detect',
      async ({ body }) => {
        try {
          const data = await solveDetectionCaptcha(body);
          return success(data);
        } catch (err) {
          logger.error('DETECT 识别错误:', err);
          return fail(err instanceof Error ? err.message || '识别失败' : '识别失败');
        }
      },
      {
        body: detectCaptchaSchema,
        response: { 200: detectResponseSchema },
        tags: ['captcha'],
      },
    )
    .post(
      '/ocr',
      async ({ body }) => {
        try {
          const data = await solveOcrCaptcha(body);
          return success(data);
        } catch (err) {
          logger.error('OCR 识别错误:', err);
          return fail(err instanceof Error ? err.message || '识别失败' : '识别失败');
        }
      },
      {
        body: ocrCaptchaSchema,
        response: { 200: ocrResponseSchema },
        tags: ['captcha'],
      },
    )
    .post(
      '/rotate',
      async ({ body }) => {
        try {
          const data = await solveRotateCaptcha(body);
          return success(data);
        } catch (err) {
          logger.error('ROTATE 识别错误:', err);
          return fail(err instanceof Error ? err.message || '识别失败' : '识别失败');
        }
      },
      {
        body: rotateCaptchaSchema,
        response: { 200: rotateResponseSchema },
        tags: ['captcha'],
      },
    )
    .post(
      '/slide',
      async ({ body }) => {
        try {
          const data = await solveSlideCaptcha(body);
          return success(data);
        } catch (err) {
          logger.error('SLIDE 识别错误:', err);
          return fail(err instanceof Error ? err.message || '识别失败' : '识别失败');
        }
      },
      {
        body: slideCaptchaSchema,
        response: { 200: slideResponseSchema },
        tags: ['captcha'],
      },
    ),
);

export default captchaController;
