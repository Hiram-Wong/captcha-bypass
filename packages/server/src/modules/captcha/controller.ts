import { Elysia } from 'elysia';

import { fail, success } from '@captcha-bypass/core/utils/response';
import { log } from '@captcha-bypass/core/utils/logger';

import { solveDetectionCaptcha, solveOcrCaptcha, solveRotateCaptcha, solveSlideCaptcha } from '@captcha-bypass/core';

import { auth } from '../../middleware/auth';
import {
  detectBodySchema,
  detectResponseSchema,
  ocrBodySchema,
  ocrResponseSchema,
  rotateBodySchema,
  rotateResponseSchema,
  slideBodySchema,
  slideResponseSchema,
} from './model';

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
        body: detectBodySchema,
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
        body: ocrBodySchema,
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
        body: rotateBodySchema,
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
        body: slideBodySchema,
        response: { 200: slideResponseSchema },
        tags: ['captcha'],
      },
    ),
);

export default captchaController;
