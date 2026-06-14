import { JSON5 } from 'bun';

import type { UploadedImage } from '@/types/shared';

/**
 * 检查是否为 HTTP(S) 链接
 */
export const isHttp = (str: unknown): boolean => typeof str === 'string' && /^https?:\/\//i.test(str);

/**
 * 检查是否为图片 MIME 类型
 */
export const isImageMime = (str: unknown): str is string =>
  typeof str === 'string' && str.toLowerCase().startsWith('image/');

/**
 * 检查是否为合法的 Node.js 文件缓冲区对象
 */
export const isBufferedFile = (obj: unknown): obj is UploadedImage => {
  if (typeof obj !== 'object' || obj === null) return false;

  const file = obj as Partial<UploadedImage>;
  return typeof file.mimetype === 'string' && Buffer.isBuffer(file.buffer);
};

/**
 * 检查是否为 Fetch/FormData 标准文件对象
 */
export const isWebFile = (obj: unknown): obj is File => {
  return typeof File !== 'undefined' && obj instanceof File;
};

/**
 * 检查是否为合法的 JSON5 字符串
 */
export const isJson5Str = (str: unknown): boolean => {
  if (typeof str !== 'string') return false;

  try {
    JSON5.parse(str);
    return true;
  } catch {
    return false;
  }
};
