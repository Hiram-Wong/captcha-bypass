import { Elysia } from 'elysia';

import { log } from '@/utils/logger';
import { fail, success } from '@/utils/response';

import { healthResponseSchema } from './model';
import { getHealth } from './service';

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
      response: {
        200: healthResponseSchema,
      },
      tags: ['health'],
    },
  ),
);

export default healthController;
