import { Elysia } from 'elysia';

import { healthResponseSchema } from './model';
import { getHealth } from './service';
import { fail, success } from '@/utils/response';

export const healthController = new Elysia({ name: 'health' }).get(
  '/health',
  () => {
    try {
      const data = getHealth();
      return success(data);
    } catch (err) {
      console.error('[HEALTH] 健康检查错误:', err);
      return fail(err instanceof Error ? err.message || '健康检查失败' : '健康检查失败');
    }
  },
  {
    response: {
      200: healthResponseSchema,
    },
  },
);

export default healthController;
