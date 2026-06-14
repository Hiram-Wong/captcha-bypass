import { t } from 'elysia';

import { apiResponse } from '../base';

export const healthResponseSchema = apiResponse(t.Object({ version: t.String(), timestamp: t.Number() }));
