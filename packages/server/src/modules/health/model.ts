import { z } from 'zod';

import { responseSchema } from '@captcha-bypass/core/utils/response';

// ── response schemas ──

export const healthResponseSchema = responseSchema(
  z.object({ name: z.string(), homepage: z.string(), version: z.string(), timestamp: z.number() }),
);
