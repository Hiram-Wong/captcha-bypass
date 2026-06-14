import { Elysia } from 'elysia';

import { healthResponseSchema } from './model';
import { getHealth } from './service';

export const healthController = new Elysia({ name: 'health/controller' }).get(
  '/health',
  () => {
    try {
      const data = getHealth();
      return { status: 0 as const, data, msg: 'success' };
    } catch (err) {
      console.error('[HEALTH] 健康检查错误:', err);
      return {
        code: -1 as const,
        msg: err instanceof Error ? err.message || '健康检查失败' : '健康检查失败',
      };
    }
  },
  {
    response: {
      200: healthResponseSchema,
    },
  },
);

export default healthController;
