import { Command } from 'commander';

import { solveDetectionCaptcha, solveOcrCaptcha, solveRotateCaptcha, solveSlideCaptcha } from '@captcha-bypass/core';
import type {
  DetectCaptchaInput,
  OcrCaptchaInput,
  RotateCaptchaInput,
  SlideCaptchaInput,
} from '@captcha-bypass/core/captcha/schema';
import { run } from '../utils/run';

const captchaCommand = (): Command => {
  const captcha = new Command('captcha').description('Captcha solver');

  captcha
    .command('detect')
    .description('Detect objects in image, or match thumb against background')
    .requiredOption('--type <type>', 'detect|match (single-image detection / two-image Hungarian matching)')
    .requiredOption('--bg <image>', 'image to detect, or background/candidate image for matching (path|URL|base64)')
    .option('--thumb <image>', 'reference image (required for type=match)')
    .action(async (opts: { type: DetectCaptchaInput['type']; bg: string; thumb?: string }) => {
      await run('detect', () => solveDetectionCaptcha({ ...opts, type: opts.type }));
    });

  captcha
    .command('ocr')
    .description('OCR character or math formula recognition')
    .requiredOption('--type <type>', 'text|math')
    .requiredOption('--bg <image>', 'image to recognize (path|URL|base64)')
    .option('--action <engine>', 'ai|onnx (default onnx)', 'onnx')
    .option('--range <chars>', "optional character set filter, e.g. '0123456789'")
    .action(
      async (opts: {
        type: OcrCaptchaInput['type'];
        bg: string;
        action: OcrCaptchaInput['action'];
        range?: string;
      }) => {
        await run('ocr', () => solveOcrCaptcha(opts));
      },
    );

  captcha
    .command('rotate')
    .description('Rotation captcha solver')
    .requiredOption('--type <type>', 'single|nox|tiktok')
    .requiredOption('--bg <image>', 'image to rotate (single), or background/reference image (nox/tiktok)')
    .option('--thumb <image>', 'foreground/rotated image (required for nox/tiktok)')
    .action(async (opts: { type: RotateCaptchaInput['type']; bg: string; thumb?: string }) => {
      await run('rotate', () => solveRotateCaptcha(opts));
    });

  captcha
    .command('slide')
    .description('Slider captcha solver')
    .requiredOption('--type <type>', 'match|compare')
    .requiredOption('--bg <image>', 'background image (path|URL|base64)')
    .requiredOption('--thumb <image>', 'slider/thumb image (path|URL|base64)')
    .action(async (opts: { type: SlideCaptchaInput['type']; bg: string; thumb: string }) => {
      await run('slide', () => solveSlideCaptcha(opts));
    });

  return captcha;
};

export { captchaCommand };
