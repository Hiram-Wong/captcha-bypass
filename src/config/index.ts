import 'dotenv/config';
import type { Static } from 'elysia';
import { t, TypeCompiler } from 'elysia/type-system';

const booleanSchema = t
  .Transform(t.Union([t.Boolean(), t.String()]))
  .Decode((value): boolean => {
    if (typeof value === 'boolean') return value;

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;

    throw new Error(`Expected boolean string`);
  })
  .Encode((value) => String(value));

const envSchema = t.Object({
  PORT: t.Numeric({ minimum: 1, maximum: 65535, multipleOf: 1 }),
  OPENAPI_ENABLE: booleanSchema,
  NODE_ENV: t.Enum({ development: 'development', production: 'production' }),
  AUTH_KEY: t.String(),
  AUTH_TYPE: t.Numeric({ minimum: 0, maximum: 2, multipleOf: 1 }),
  DETECT_MODEL_PATH: t.String(),
  OCR_MODEL_PATH: t.String(),
  OCR_CHARSET_PATH: t.String(),
  OCR_CHARSET_RANGES: t.String(),
  ROTATE_MODEL_PATH: t.String(),
});

type Env = Static<typeof envSchema>;

const envDefaults = {
  PORT: 7788,
  OPENAPI_ENABLE: false,
  NODE_ENV: 'development',
  AUTH_KEY: '',
  AUTH_TYPE: 0,
  DETECT_MODEL_PATH: '',
  OCR_MODEL_PATH: '',
  OCR_CHARSET_PATH: '',
  OCR_CHARSET_RANGES: '',
  ROTATE_MODEL_PATH: '',
} satisfies Env;

const envValidator = TypeCompiler.Compile(envSchema);

const formatEnvErrors = (value: unknown): string =>
  [...envValidator.Errors(value)].map((error) => `${error.path || '/'}: ${error.message}`).join('\n');

const parseEnv = (): Env => {
  const rawEnv = {
    ...envDefaults,
    ...process.env,
  };

  if (!envValidator.Check(rawEnv)) {
    throw new Error(`配置文件校验失败:\n${formatEnvErrors(rawEnv)}`);
  }

  try {
    return envValidator.Decode(rawEnv);
  } catch (err) {
    throw new Error(`配置文件校验失败:\n${err instanceof Error ? err.message : '环境变量格式错误'}`);
  }
};

const env = parseEnv();

export const config = {
  port: env.PORT,
  openapiEnable: env.OPENAPI_ENABLE,
  nodeEnv: env.NODE_ENV,
  auth: {
    key: env.AUTH_KEY,
    type: env.AUTH_TYPE,
  },
  ocr: {
    modelPath: env.OCR_MODEL_PATH || 'models/ocr.onnx',
    charsetPath: env.OCR_CHARSET_PATH || 'models/ocr.json',
    charsetRanges: env.OCR_CHARSET_RANGES || '',
  },
  rotate: {
    modelPath: env.ROTATE_MODEL_PATH || 'models/rotate.onnx',
  },
  detect: {
    modelPath: env.DETECT_MODEL_PATH || 'models/detect.onnx',
  },
} as const;

export type AppConfig = typeof config;
