import { z } from 'zod';

import {
  detectCaptchaSchema,
  imageStringSchema,
  ocrCaptchaSchema,
  rotateCaptchaSchema,
  slideCaptchaSchema,
} from '@captcha-bypass/core/captcha/schema';
import { responseSchema } from '@captcha-bypass/core/utils/response';

// ── body schemas ──

const imageFile = z.file().refine((file) => file.type.startsWith('image/'), '上传文件不是图片');
const bodyImage = z.union([imageStringSchema, imageFile]);

export const detectBodySchema = detectCaptchaSchema.extend({ bg: bodyImage, thumb: bodyImage.optional() });
export const ocrBodySchema = ocrCaptchaSchema.extend({ bg: bodyImage });
export const rotateBodySchema = rotateCaptchaSchema.extend({ bg: bodyImage, thumb: bodyImage.optional() });
export const slideBodySchema = slideCaptchaSchema.extend({ bg: bodyImage, thumb: bodyImage });

// ── response schemas ──

export const detectResponseSchema = responseSchema(
  z.array(
    z.object({
      target: z.string(),
      coordinate: z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
    }),
  ),
);

export const ocrResponseSchema = responseSchema(
  z.union([z.object({ code: z.string() }), z.object({ formula: z.string(), result: z.number() })]),
);

export const rotateResponseSchema = responseSchema(z.object({ cw: z.number(), ccw: z.number() }));

export const slideResponseSchema = responseSchema(z.object({ x: z.number(), y: z.number() }));
