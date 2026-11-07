import { z } from 'zod';

/**
 * 图片输入（纯字符串形态，供 CLI / MCP 使用）：
 * 文件路径 | URL | Base64
 */
export const imageStringSchema = z
  .string()
  .min(1)
  .describe('Image as file path, URL, or base64 string (with or without data URI prefix)');

// ── request schemas ──

export const detectCaptchaSchema = z.object({
  type: z
    .enum(['detect', 'match'])
    .describe("'detect' for single-image detection, 'match' for two-image Hungarian matching"),
  bg: imageStringSchema.describe('The image to detect objects in, or the background/candidate image for matching'),
  thumb: imageStringSchema.optional().describe('The reference image for matching (required for type=match)'),
});

export const ocrCaptchaSchema = z.object({
  type: z
    .enum(['text', 'math'])
    .describe("Recognition type: 'text' for character recognition, 'math' for math formula recognition"),
  action: z
    .enum(['ai', 'onnx'])
    .default('onnx')
    .describe(
      "Recognition engine: 'onnx' uses local ONNX model (default, fast), 'ai' uses LLM vision API for text extraction (higher accuracy for complex captchas)",
    ),
  bg: imageStringSchema.describe('Image as base64 string (with or without data URI prefix) or image URL'),
  range: z
    .string()
    .optional()
    .describe(
      "Optional character set filter, e.g. '0123456789' to only recognize digits, '0123456789+-*/' for math captcha",
    ),
});

export const rotateCaptchaSchema = z.object({
  type: z
    .enum(['single', 'nox', 'tiktok'])
    .describe(
      "Detection type: 'single' for single image rotation, 'nox' for two-image comparison, 'tiktok' for TikTok-style rotation",
    ),
  bg: imageStringSchema.describe(
    'The image to rotate as base64 string or URL (for single), or the background/reference image (for nox/tiktok)',
  ),
  thumb: imageStringSchema
    .optional()
    .describe('The foreground/rotated image as base64 string or URL (required for nox and tiktok types)'),
});

export const slideCaptchaSchema = z.object({
  type: z
    .enum(['match', 'compare'])
    .describe("Match type: 'match' for template matching (Canny + TM), 'compare' for difference comparison"),
  bg: imageStringSchema.describe('The background image as base64 string or URL'),
  thumb: imageStringSchema.describe('The slider/thumb image as base64 string or URL'),
});

// ── types ──

/** 服务端 multipart 上传时的图片形态（与字符串输入等价） */
export type ImageRef = string | File;

/** 将 bg/thumb 从纯字符串宽化为 string | File，保留其余字段（含可选性） */
type WidenImages<T> = {
  [K in keyof T]: K extends 'bg' | 'thumb' ? ImageRef : T[K];
};

export type DetectCaptchaInput = WidenImages<z.output<typeof detectCaptchaSchema>>;
export type OcrCaptchaInput = WidenImages<z.output<typeof ocrCaptchaSchema>>;
export type RotateCaptchaInput = WidenImages<z.output<typeof rotateCaptchaSchema>>;
export type SlideCaptchaInput = WidenImages<z.output<typeof slideCaptchaSchema>>;
