import { t, type Static } from 'elysia';

import { apiResponse } from '../base';
import { ImageInput } from '@/utils/model';

// ── request schemas ──

export const detectCaptchaSchema = t.Object({
  type: t.Enum({ detect: 'detect', match: 'match' }),
  bg: ImageInput,
  thumb: t.Optional(ImageInput),
});

export const ocrCaptchaSchema = t.Object({
  type: t.Enum({ text: 'text', math: 'math' }),
  bg: ImageInput,
  range: t.Optional(t.String()),
});

export const rotateCaptchaSchema = t.Object({
  type: t.Enum({ single: 'single', nox: 'nox', tiktok: 'tiktok' }),
  bg: ImageInput,
  thumb: t.Optional(ImageInput),
});

export const slideCaptchaSchema = t.Object({
  type: t.Enum({ match: 'match', compare: 'compare' }),
  bg: ImageInput,
  thumb: ImageInput,
});

// ── response schemas ──

export const detectResponseSchema = apiResponse(
  t.Array(
    t.Object({
      target: t.String(),
      coordinate: t.Object({ x1: t.Number(), y1: t.Number(), x2: t.Number(), y2: t.Number() }),
    }),
  ),
);

export const ocrResponseSchema = apiResponse(
  t.Union([t.Object({ code: t.String() }), t.Object({ formula: t.String(), result: t.Number() })]),
);

export const rotateResponseSchema = apiResponse(t.Object({ cw: t.Number(), ccw: t.Number() }));

export const slideResponseSchema = apiResponse(t.Object({ x: t.Number(), y: t.Number() }));

// ── types ──

export type OcrCaptchaInput = Static<typeof ocrCaptchaSchema>;
export type RotateCaptchaInput = Static<typeof rotateCaptchaSchema>;
export type SlideCaptchaInput = Static<typeof slideCaptchaSchema>;
export type DetectCaptchaInput = Static<typeof detectCaptchaSchema>;
