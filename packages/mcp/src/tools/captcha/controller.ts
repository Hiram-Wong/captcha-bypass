import type { McpServer } from '@modelcontextprotocol/server';

import type { Executor } from '../../executor';
import { createToolCall } from '../../utils/tool';
import { detectSchema, ocrSchema, rotateSchema, slideSchema } from './schema';

export function captchaController(server: McpServer, executor: Executor): void {
  server.registerTool(
    'detect',
    {
      title: 'Detect Captcha',
      description:
        'Detect objects in captcha images using YOLO-style target detection, or match thumb objects to a background using Hungarian algorithm. Returns an array of {target, coordinate} where target is a base64 cropped image of each detected object.',
      inputSchema: detectSchema,
      annotations: { readOnlyHint: true },
    },
    createToolCall((args) => executor({ url: '/captcha/detect', ...args })),
  );

  server.registerTool(
    'ocr',
    {
      title: 'OCR Captcha',
      description:
        'Recognize text or math formula from captcha images. Use action parameter (optional, defaults to "onnx") to select engine: "onnx" (local ONNX model, fast) or "ai" (LLM vision API, higher accuracy for complex captchas).',
      inputSchema: ocrSchema,
      annotations: { readOnlyHint: true },
    },
    createToolCall((args) => executor({ url: '/captcha/ocr', ...args })),
  );

  server.registerTool(
    'rotate',
    {
      title: 'Rotate Captcha',
      description:
        'Detect rotation angle of captcha images. Supports single image rotation detection and double image comparison (nox/tiktok).',
      inputSchema: rotateSchema,
      annotations: { readOnlyHint: true },
    },
    createToolCall((args) => executor({ url: '/captcha/rotate', ...args })),
  );

  server.registerTool(
    'slide',
    {
      title: 'Slide Captcha',
      description:
        'Match slider captcha position by comparing slider image with background image. Returns the x,y coordinates of the best match.',
      inputSchema: slideSchema,
      annotations: { readOnlyHint: true },
    },
    createToolCall((args) => executor({ url: '/captcha/slide', ...args })),
  );
}

export default captchaController;
