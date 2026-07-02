import 'dotenv/config';
import { type Static } from 'elysia';
import { t, TypeCompiler } from 'elysia/type-system';

const booleanSchema = t
  .Transform(t.Union([t.Boolean(), t.String(), t.Undefined()]))
  .Decode((value): boolean => {
    if (value === undefined) return false;
    if (typeof value === 'boolean') return value;

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;

    throw new Error(`Expected boolean string`);
  })
  .Encode((value) => String(value));

const numericArraySchema = (itemOptions: { minimum?: number; multipleOf?: number }, defaultValue: number[]) =>
  t
    .Transform(t.Union([t.Array(t.Numeric(itemOptions)), t.String(), t.Undefined()]))
    .Decode((value): number[] => {
      if (value === undefined) return defaultValue;
      if (Array.isArray(value)) return value;
      return JSON.parse(value);
    })
    .Encode((value) => JSON.stringify(value));

const envSchema = t.Object({
  // runtime
  RUN_MODE: t.Optional(t.Enum({ cli: 'cli', server: 'server' }, { default: 'cli' })),
  NODE_ENV: t.Optional(t.Enum({ development: 'development', production: 'production' }, { default: 'development' })),
  LOG_LEVEL: t.Optional(
    t.Enum({ silly: 'silly', debug: 'debug', info: 'info', warn: 'warn', error: 'error' }, { default: 'info' }),
  ),

  // server
  PORT: t.Optional(t.Numeric({ minimum: 1, maximum: 65535, multipleOf: 1, default: 7788 })),
  OPENAPI_ENABLE: t.Optional(booleanSchema),

  // auth
  AUTH_KEY: t.Optional(t.String({ default: '' })),
  AUTH_TYPE: t.Optional(t.Numeric({ minimum: 0, maximum: 2, multipleOf: 1, default: 0 })),

  // detect
  DETECT_MODEL_PATH: t.Optional(t.String({ default: 'models/detect.onnx' })),
  // DETECT_SHAPE: t.Optional(t.Array(t.Numeric({ minimum: 0, multipleOf: 1 }), { default: [3, 416, 416] })),
  // DETECT_MEAN: t.Optional(t.Array(t.Numeric({ multipleOf: 0.001 }), { default: [0, 0, 0] })),
  // DETECT_STD: t.Optional(t.Array(t.Numeric({ multipleOf: 0.001 }), { default: [1, 1, 1] })),

  // ocr
  OCR_MODEL_PATH: t.Optional(t.String({ default: 'models/ocr_ppv5-cn.onnx' })),
  OCR_CHARSET_PATH: t.Optional(t.String({ default: 'models/ocr_ppv5-cn.json' })),
  OCR_CHARSET_RANGES: t.Optional(t.String({ default: '' })),
  OCR_SHAPE: t.Optional(numericArraySchema({ minimum: 0, multipleOf: 1 }, [3, 48, 0])),
  OCR_MEAN: t.Optional(t.Numeric({ default: 0.5 })),
  OCR_STD: t.Optional(t.Numeric({ default: 0.5 })),
  OCR_CTC_LAYOUT: t.Optional(t.Enum({ tnc: 'tnc', ntc: 'ntc' }, { default: 'tnc' })),

  // rotate
  ROTATE_MODEL_PATH: t.Optional(t.String({ default: 'models/rotate.onnx' })),
  // ROTATE_SHAPE: t.Optional(t.Array(t.Numeric({ minimum: 0, multipleOf: 1 }), { default: [3, 224, 224] })),
  // ROTATE_MEAN: t.Optional(t.Array(t.Numeric({ multipleOf: 0.001 }), { default: [0.485, 0.456, 0.406] })),
  // ROTATE_STD: t.Optional(t.Array(t.Numeric({ multipleOf: 0.001 }), { default: [0.229, 0.224, 0.225] })),

  // openai
  OPENAI_BASE_URL: t.Optional(t.String({ default: '' })),
  OPENAI_API_KEY: t.Optional(t.String({ default: '' })),
  OPENAI_OCR_MODEL: t.Optional(t.String({ default: 'PaddleOCR-VL-1.6' })),
  OPENAI_MODEL: t.Optional(t.String({ default: 'gpt-5.5' })),
});

const envValidator = TypeCompiler.Compile(envSchema);

const formatEnvErrors = (value: unknown): string =>
  [...envValidator.Errors(value)].map((error) => `${error.path || '/'}: ${error.message}`).join('\n');

type Env = Required<Static<typeof envSchema>>;

const parseEnv = (): Env => {
  const rawEnv = { ...process.env };

  if (!envValidator.Check(rawEnv)) {
    throw new Error(`配置文件校验失败:\n${formatEnvErrors(rawEnv)}`);
  }

  try {
    return envValidator.Decode(rawEnv) as Env;
  } catch (err) {
    throw new Error(`配置文件校验失败:\n${err instanceof Error ? err.message : '环境变量格式错误'}`);
  }
};

const env = parseEnv();

export const config = {
  runMode: env.RUN_MODE,
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
    // shape: env.ROTATE_SHAPE,
    // mean: env.ROTATE_MEAN,
    // std: env.ROTATE_STD,
  },
  detect: {
    modelPath: env.DETECT_MODEL_PATH,
    // shape: env.DETECT_SHAPE,
    // mean: env.DETECT_MEAN,
    // std: env.DETECT_STD,
  },
  openai: {
    baseURL: env.OPENAI_BASE_URL,
    apiKey: env.OPENAI_API_KEY,
    ocrModel: env.OPENAI_OCR_MODEL,
    model: env.OPENAI_MODEL,
  },
} as const;

export type AppConfig = typeof config;
