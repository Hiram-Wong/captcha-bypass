import 'dotenv/config';
import { JSON5 } from 'bun';
import { type Static } from 'elysia';
import { t, TypeCompiler } from 'elysia/type-system';

import { isJsonStr } from '@/utils/validate';

const booleanSchema = t
  .Transform(t.Union([t.Boolean(), t.String(), t.Undefined()]))
  .Decode((value): boolean => {
    if (value === undefined) return false;
    if (typeof value === 'boolean') return value;

    const v = value.trim().toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(v)) return false;

    throw new Error(`Invalid boolean: ${value}`);
  })
  .Encode(String);

const numericArraySchema = (itemOptions: { minimum?: number; multipleOf?: number }, fallback: number[]) =>
  t
    .Transform(t.Union([t.Array(t.Numeric(itemOptions)), t.String(), t.Undefined()]))
    .Decode((value): number[] => {
      if (Array.isArray(value)) return value;
      if (isJsonStr(value)) return JSON5.parse(value) as number[];

      throw new Error(`Invalid numeric array: ${value}`);
    })
    .Encode((v) => JSON.stringify(v));

const ENV_DEFAULTS = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'none',
  PORT: 7788,
  OPENAPI_ENABLE: false,

  AUTH_KEY: '',
  AUTH_TYPE: 0,

  DETECT_MODEL_PATH: 'models/detect.onnx',
  DETECT_SHAPE: [3, 416, 416],
  DETECT_MEAN: [0, 0, 0],
  DETECT_STD: [1, 1, 1],

  OCR_MODEL_PATH: 'models/ocr_ppv5-cn.onnx',
  OCR_CHARSET_PATH: 'models/ocr_ppv5-cn.json',
  OCR_CHARSET_RANGES: '',
  OCR_SHAPE: [3, 48, 320],
  OCR_MEAN: 0.5,
  OCR_STD: 0.5,
  OCR_CTC_LAYOUT: 'ntc',

  ROTATE_MODEL_PATH: 'models/rotate.onnx',
  ROTATE_SHAPE: [3, 224, 224],
  ROTATE_MEAN: [0.485, 0.456, 0.406],
  ROTATE_STD: [0.229, 0.224, 0.225],

  OPENAI_BASE_URL: '',
  OPENAI_API_KEY: '',
  OPENAI_OCR_MODEL: 'PaddleOCR-VL-1.6',
  OPENAI_MODEL: 'gpt-5.5',
} as const;

const envSchema = t.Object({
  NODE_ENV: t.Optional(t.Enum({ development: 'development', production: 'production' })),
  LOG_LEVEL: t.Optional(
    t.Enum({ silly: 'silly', debug: 'debug', info: 'info', warn: 'warn', error: 'error', none: 'none' }),
  ),

  PORT: t.Optional(t.Numeric({ minimum: 1, maximum: 65535 })),
  OPENAPI_ENABLE: t.Optional(booleanSchema),

  AUTH_KEY: t.Optional(t.String()),
  AUTH_TYPE: t.Optional(t.Numeric({ minimum: 0, maximum: 2 })),

  DETECT_MODEL_PATH: t.Optional(t.String()),
  DETECT_SHAPE: t.Optional(numericArraySchema({ minimum: 0 }, [3, 416, 416])),
  DETECT_MEAN: t.Optional(numericArraySchema({ minimum: 0 }, [0, 0, 0])),
  DETECT_STD: t.Optional(numericArraySchema({ minimum: 0 }, [1, 1, 1])),

  OCR_MODEL_PATH: t.Optional(t.String()),
  OCR_CHARSET_PATH: t.Optional(t.String()),
  OCR_CHARSET_RANGES: t.Optional(t.String()),
  OCR_SHAPE: t.Optional(numericArraySchema({ minimum: 0 }, [3, 48, 320])),
  OCR_MEAN: t.Optional(t.Numeric({ minimum: 0 })),
  OCR_STD: t.Optional(t.Numeric({ minimum: 0 })),
  OCR_CTC_LAYOUT: t.Optional(t.Enum({ tnc: 'tnc', ntc: 'ntc' })),

  ROTATE_MODEL_PATH: t.Optional(t.String()),
  ROTATE_SHAPE: t.Optional(numericArraySchema({ minimum: 0 }, [3, 224, 224])),
  ROTATE_MEAN: t.Optional(numericArraySchema({ minimum: 0 }, [0.485, 0.456, 0.406])),
  ROTATE_STD: t.Optional(numericArraySchema({ minimum: 0 }, [0.229, 0.224, 0.225])),

  OPENAI_BASE_URL: t.Optional(t.String()),
  OPENAI_API_KEY: t.Optional(t.String()),
  OPENAI_OCR_MODEL: t.Optional(t.String()),
  OPENAI_MODEL: t.Optional(t.String()),
});

const validator = TypeCompiler.Compile(envSchema);

type Env = Required<Static<typeof envSchema>>;

const parseEnv = (): Env => {
  const raw: Record<string, unknown> = { ...ENV_DEFAULTS };

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) raw[key] = value;
  }

  if (!validator.Check(raw)) {
    const errors = [...validator.Errors(raw)].map((e) => `${e.path}: ${e.message}`).join('\n');

    throw new Error(`Config validation failed:\n${errors}`);
  }

  return validator.Decode(raw) as Env;
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
    key: env.AUTH_KEY,
    type: env.AUTH_TYPE,
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
  openai: {
    baseURL: env.OPENAI_BASE_URL,
    apiKey: env.OPENAI_API_KEY,
    ocrModel: env.OPENAI_OCR_MODEL,
    model: env.OPENAI_MODEL,
  },
} as const;

export type AppConfig = typeof config;
