import { z } from 'zod';

/**
 * 图片输入（纯字符串形态，供 CLI / MCP 使用）：
 * 文件路径 | URL | Base64
 */
const imageStringSchema = z
  .string()
  .min(1)
  .describe('Image as file path, URL, or base64 string (with or without data URI prefix)');

// ── request schemas ──
// 内联自 @captcha-bypass/core/captcha/schema，避免 mcp 打包依赖 core

export const detectSchema = z.object({
  type: z
    .enum(['detect', 'match'])
    .describe("'detect' for single-image detection, 'match' for two-image Hungarian matching"),
  bg: imageStringSchema.describe('The image to detect objects in, or the background/candidate image for matching'),
  thumb: imageStringSchema.optional().describe('The reference image for matching (required for type=match)'),
});

export const ocrSchema = z.object({
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

export const rotateSchema = z.object({
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

export const slideSchema = z.object({
  type: z
    .enum(['match', 'compare'])
    .describe("Match type: 'match' for template matching (Canny + TM), 'compare' for difference comparison"),
  bg: imageStringSchema.describe('The background image as base64 string or URL'),
  thumb: imageStringSchema.describe('The slider/thumb image as base64 string or URL'),
});
