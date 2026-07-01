import process from 'node:process';

import { Value } from '@sinclair/typebox/value';
import { main } from 'bun';
import { program } from 'commander';

import { APP_DESC, APP_NAME, APP_VERSION } from '@/utils/appInfo';
import { BaseCvService } from '@/captcha/base/cv';
import { detectCaptchaService } from '@/captcha/detect';
import { ocrCaptchaService } from '@/captcha/ocr';
import { rotateCaptchaService } from '@/captcha/rotate';
import {
  solveDetectionCaptcha,
  solveOcrCaptcha,
  solveRotateCaptcha,
  solveSlideCaptcha,
} from '@/modules/captcha/service';
import type {
  DetectCaptchaInput,
  OcrCaptchaInput,
  RotateCaptchaInput,
  SlideCaptchaInput,
} from '@/modules/captcha/model';
import {
  detectCaptchaSchema,
  ocrCaptchaSchema,
  rotateCaptchaSchema,
  slideCaptchaSchema,
} from '@/modules/captcha/model';
import type { TSchema } from '@sinclair/typebox';

// ── Validator ──

const validate = <T>(schema: TSchema, data: unknown): T => {
  if (!Value.Check(schema, data)) {
    const errors = [...Value.Errors(schema, data)].map((e) => `${e.path}: ${e.message}`);
    console.error(`参数校验失败: ${errors.join('; ')}`);
    process.exit(1);
  }
  return data as T;
};

// ── Init models ──

const commandInits: Record<string, () => Promise<void>> = {
  detect: () => detectCaptchaService.init(),
  ocr: () => ocrCaptchaService.init(),
  rotate: async () => {
    await Promise.all([rotateCaptchaService.init(), BaseCvService.init()]);
  },
  slide: () => BaseCvService.init(),
};

// ── Commands ──

program
  .name(APP_NAME)
  .description(APP_DESC)
  .version(APP_VERSION)
  .hook('preAction', async (_thisCommand, actionCommand) => {
    const init = commandInits[actionCommand.name()];
    if (init) await init();
  });

program
  .command('detect')
  .description('目标检测')
  .requiredOption('--type <type>', '识别类型: detect | match')
  .requiredOption('--bg <image>', '背景/主图: 文件路径 | URL | Base64')
  .option('--thumb <image>', '小图 (match 模式必填)')
  .action(async (opts) => {
    const input = validate<DetectCaptchaInput>(detectCaptchaSchema, {
      type: opts.type,
      bg: opts.bg,
      thumb: opts.thumb,
    });
    const result = await solveDetectionCaptcha(input);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('ocr')
  .description('文字/算术验证码识别')
  .requiredOption('--type <type>', '识别类型: text | math')
  .requiredOption('--bg <image>', '图片: 文件路径 | URL | Base64')
  .option('--action <engine>', '识别引擎: onnx | ai', 'onnx')
  .option('--range <chars>', '字符范围, 如 0123456789')
  .action(async (opts) => {
    const input = validate<OcrCaptchaInput>(ocrCaptchaSchema, {
      type: opts.type,
      action: opts.action,
      bg: opts.bg,
      range: opts.range,
    });
    const result = await solveOcrCaptcha(input);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('rotate')
  .description('旋转验证码识别')
  .requiredOption('--type <type>', '识别类型: single | nox | tiktok')
  .requiredOption('--bg <image>', '图片/背景图: 文件路径 | URL | Base64')
  .option('--thumb <image>', '小图 (nox/tiktok 模式必填)')
  .action(async (opts) => {
    const input = validate<RotateCaptchaInput>(rotateCaptchaSchema, {
      type: opts.type,
      bg: opts.bg,
      thumb: opts.thumb,
    });
    const result = await solveRotateCaptcha(input);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('slide')
  .description('滑块验证码识别')
  .requiredOption('--type <type>', '识别类型: match | compare')
  .requiredOption('--bg <image>', '背景图: 文件路径 | URL | Base64')
  .requiredOption('--thumb <image>', '滑块图: 文件路径 | URL | Base64')
  .action(async (opts) => {
    const input = validate<SlideCaptchaInput>(slideCaptchaSchema, {
      type: opts.type,
      bg: opts.bg,
      thumb: opts.thumb,
    });
    const result = await solveSlideCaptcha(input);
    console.log(JSON.stringify(result, null, 2));
  });

const startCli = (): Promise<void> =>
  program
    .parseAsync()
    .then(() => {})
    .catch((err) => {
      console.error('执行失败:', err instanceof Error ? err.message : err);
      process.exit(1);
    });

if (import.meta.path === main) {
  void startCli();
}

export { startCli };
