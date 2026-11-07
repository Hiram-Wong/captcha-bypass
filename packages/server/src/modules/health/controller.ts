import { Elysia } from 'elysia';

import { fail, success } from '@captcha-bypass/core/utils/response';
import { log } from '@captcha-bypass/core/utils/logger';
import { getHealth } from '@captcha-bypass/core/health';

import { healthResponseSchema } from './model';

const logger = log.withContext('CONTROLLER<health>');

export const healthController = new Elysia({ name: 'health' }).group('/health', (app) =>
  app.get(
    '',
    () => {
      try {
        const data = getHealth();
        return success(data);
      } catch (err) {
        logger.error('健康检查错误:', err);
        return fail(err instanceof Error ? err.message || '健康检查失败' : '健康检查失败');
      }
    },
    {
      response: { 200: healthResponseSchema },
      tags: ['health'],
    },
  ),
);

export default healthController;
