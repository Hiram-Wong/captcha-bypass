import 'dotenv/config';

import process from 'node:process';

import { JSON5 } from 'bun';
import { z } from 'zod';

import { isJSONStr } from './utils/validate';

const booleanSchema = z.preprocess((value) => {
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const v = value.toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(v)) return false;
  }

  return value;
}, z.boolean());

const numericArraySchema = z.preprocess(
  (value) => {
    if (isJSONStr(value)) return JSON5.parse(value) as unknown;

    return value;
  },
  z.array(z.number().min(0)),
);

const stringArraySchema = z.preprocess((value) => {
  if (isJSONStr(value)) return JSON5.parse(value) as unknown;

  return value;
}, z.array(z.string()));

const ENV_DEFAULTS = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'none',
  PORT: 7788,
  OPENAPI_ENABLE: false,

  AUTH_KEYS: [],

  DETECT_MODEL_PATH: 'models/detect.onnx',
  DETECT_SHAPE: [3, 416, 416],
  DETECT_MEAN: [0, 0, 0],
  DETECT_STD: [1, 1, 1],

  OCR_MODEL_PATH: 'models/ocr_pp.onnx',
  OCR_CHARSET_PATH: 'models/ocr_pp.json',
  OCR_CHARSET_RANGES: '',
  OCR_SHAPE: [3, 48, 320],
  OCR_MEAN: 0.5,
  OCR_STD: 0.5,
  OCR_CTC_LAYOUT: 'ntc',

  ROTATE_MODEL_PATH: 'models/rotate.onnx',
  ROTATE_SHAPE: [3, 224, 224],
  ROTATE_MEAN: [0.485, 0.456, 0.406],
  ROTATE_STD: [0.229, 0.224, 0.225],

  AI_TYPE: 'openai',
  AI_BASE_URL: '',
  AI_API_KEY: '',
  AI_OCR_MODEL: 'PaddleOCR-VL-1.6',
  AI_MODEL: 'gpt-5.5',
} as const;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']),
  LOG_LEVEL: z.enum(['silly', 'debug', 'info', 'warn', 'error', 'none']),

  PORT: z.coerce.number().int().min(1).max(65535),
  OPENAPI_ENABLE: booleanSchema,

  AUTH_KEYS: stringArraySchema,

  DETECT_MODEL_PATH: z.string(),
  DETECT_SHAPE: numericArraySchema,
  DETECT_MEAN: numericArraySchema,
  DETECT_STD: numericArraySchema,

  OCR_MODEL_PATH: z.string(),
  OCR_CHARSET_PATH: z.string(),
  OCR_CHARSET_RANGES: z.string(),
  OCR_SHAPE: numericArraySchema,
  OCR_MEAN: z.coerce.number().min(0),
  OCR_STD: z.coerce.number().min(0),
  OCR_CTC_LAYOUT: z.enum(['tnc', 'ntc']),

  ROTATE_MODEL_PATH: z.string(),
  ROTATE_SHAPE: numericArraySchema,
  ROTATE_MEAN: numericArraySchema,
  ROTATE_STD: numericArraySchema,

  AI_TYPE: z.enum(['anthropic', 'google', 'ollama', 'openai', 'openai-response']),
  AI_BASE_URL: z.string(),
  AI_API_KEY: z.string(),
  AI_OCR_MODEL: z.string(),
  AI_MODEL: z.string(),
});

type Env = z.infer<typeof envSchema>;

const parseEnv = (): Env => {
  const raw: Record<string, unknown> = { ...ENV_DEFAULTS };

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) raw[key] = value;
  }

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');

    throw new Error(`Config validation failed:\n${errors}`);
  }

  return parsed.data;
};

const env = parseEnv();

export const config = {
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  server: {
    port: env.PORT,
    openapiEnable: env.OPENAPI_ENABLE,
  },
  auth: {
    keys: env.AUTH_KEYS,
  },
  detect: {
    modelPath: env.DETECT_MODEL_PATH,
    shape: env.DETECT_SHAPE,
    mean: env.DETECT_MEAN,
    std: env.DETECT_STD,
  },
  ocr: {
    modelPath: env.OCR_MODEL_PATH,
    charsetPath: env.OCR_CHARSET_PATH,
    charsetRanges: env.OCR_CHARSET_RANGES,
    shape: env.OCR_SHAPE,
    mean: env.OCR_MEAN,
    std: env.OCR_STD,
    ctc: {
      layout: env.OCR_CTC_LAYOUT,
    },
  },
  rotate: {
    modelPath: env.ROTATE_MODEL_PATH,
    shape: env.ROTATE_SHAPE,
    mean: env.ROTATE_MEAN,
    std: env.ROTATE_STD,
  },
  ai: {
    type: env.AI_TYPE,
    baseURL: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    ocrModel: env.AI_OCR_MODEL,
    model: env.AI_MODEL,
  },
} as const;

export type AppConfig = typeof config;
