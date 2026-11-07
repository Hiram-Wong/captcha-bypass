import type { McpRuntimeConfig } from '../config';

import { createRequestExecutor } from './request';
import type { Executor } from './types';

export type { Executor, ExecutorInput } from './types';

export const createExecutor = (config: McpRuntimeConfig): Executor => createRequestExecutor(config);
