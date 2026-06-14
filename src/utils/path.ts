import { dirname, resolve } from 'node:path';

import { isPackaged } from '@/utils/systeminfo';

export const ROOT_PATH = isPackaged ? dirname(process.execPath) : resolve(import.meta.dir, '../..');
