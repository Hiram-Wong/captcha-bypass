import type { ImageInput } from '@/types/shared.js';
import { isBufferedFile, isHttp, isImageMime, isWebFile } from './validate';

export const toImageBase64 = async (data: ImageInput): Promise<string> => {
  // Buffered upload file
  if (isBufferedFile(data)) {
    if (!isImageMime(data.mimetype)) {
      throw new Error('上传文件不是图片');
    }

    return `data:${data.mimetype};base64,${data.buffer.toString('base64')}`;
  }

  // FormData File
  if (isWebFile(data)) {
    if (!isImageMime(data.type)) {
      throw new Error('上传文件不是图片');
    }

    const buffer = await data.arrayBuffer();
    return `data:${data.type};base64,${Buffer.from(buffer).toString('base64')}`;
  }

  // URL
  if (isHttp(data)) {
    const res = await fetch(data, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error('无法访问图片链接');
    }

    const contentType = res.headers.get('content-type') || '';
    if (!isImageMime(contentType)) {
      throw new Error('链接资源不是图片');
    }

    const buffer = await res.arrayBuffer();
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
  }

  if (typeof data !== 'string') {
    throw new Error('不支持的图片数据类型');
  }

  // base64（无前缀补全）
  if (!data.includes('base64,')) {
    return `data:image/png;base64,${data}`;
  }

  return data;
};

export const toMath = (data: string): string => {
  // prettier-ignore
  const map: Record<string, string> = {
    // 数字
    '零': '0', '〇': '0',
    '一': '1', '壹': '1', '①': '1',
    '二': '2', '贰': '2', '②': '2',
    '三': '3', '叁': '3', '③': '3',
    '四': '4', '肆': '4', '④': '4',
    '五': '5', '伍': '5', '⑤': '5',
    '六': '6', '陆': '6', '⑥': '6',
    '七': '7', '柒': '7', '⑦': '7',
    '八': '8', '捌': '8', '⑧': '8',
    '九': '9', '玖': '9', '⑨': '9',

    // 运算符
    '加': '+', '﹢': '+', '⁺': '+', '₊': '+',
    '减': '-', '–': '-', '—': '-', '−': '-', '﹣': '-', '⁻': '-', '₋': '-', '_': '-', 'ˍ':'-', '‾': '-',
    '乘': '*', '✕': '*', '✖': '*', '×': '*', 'Ⅹ': '*', 'ⅹ': '*', 'x': '*', 'X': '*', 
    '除': '/', '÷': '/', '⁄': '/', '∕': '/',
    '等': '=', '＝': '=', '﹦': '=', '≈': '=',

    // 其他
    // '（': '(', '）': ')'
  };

  const result = data
    .trim()
    .normalize('NFKC')

    .replace(/./g, (ch) => map[ch] ?? ch) // OCR 噪声

    .replace(/=+$/, '')
    .split('=')[0] // 截断等号内容
    .replace(/[^\d+\-*/.=]/g, ''); // 过滤非相关字符

  return result;
};
