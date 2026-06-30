import { t } from 'elysia';

import { schema } from '@/utils/response';

export const healthResponseSchema = schema(
  t.Object({ name: t.String(), homepage: t.String(), version: t.String(), timestamp: t.Number() }),
);
