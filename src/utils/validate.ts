import { JSON5 } from 'bun';

import type { JsonRpcV2, UploadedImage } from '@/types/shared';

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
 * 检查是否为 Node.js 文件缓冲区对象
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
 * 检查是否为 JSON 对象
 */
export function isJson(obj: unknown): obj is object {
  return typeof obj === 'object' && obj !== null;
}

/**
 * 检查是否为 JSON 字符串
 */
export const isJsonStr = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;

  try {
    const resp = JSON5.parse(str);
    if (!isJson(resp)) return false;
    return true;
  } catch {
    return false;
  }
};

/**
 * 检查是否为 JSON-RPC 2.0 请求对象
 */
export const isJsonRpcV2 = (msg: unknown): msg is JsonRpcV2 => {
  if (!isJson(msg)) return false;
  if (!('jsonrpc' in msg) || (msg as JsonRpcV2).jsonrpc !== '2.0') return false;
  if (!('method' in msg)) return false;
  return true;
};