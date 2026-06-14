import { openapi } from '@elysia/openapi';
import { cors } from '@elysia/cors';
import { JSON5 } from 'bun';
import { Elysia } from 'elysia';
import process from 'node:process';

import { detectCaptchaService } from '@/captcha/detect';
import { ocrCaptchaService } from '@/captcha/ocr';
import { rotateCaptchaService } from '@/captcha/rotate';
import { config } from '@/config';
import { captchaController } from '@/modules/captcha';
import { mcpController } from '@/modules/mcp';
import { healthController } from '@/modules/health';
import { isJson5Str } from '@/utils/validate';
import consoleUtils from '@/utils/console';

process.on('uncaughtException', (err) => {
  console.error('[SYSTEM] 未捕获异常:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[SYSTEM] Promise异常:', err);
});

const setupModel = async (): Promise<void> => {
  await Promise.all([detectCaptchaService.init(), ocrCaptchaService.init(), rotateCaptchaService.init()]);
};

const setupServer = async (): Promise<void> => {
  new Elysia({
    serve: {
      maxRequestBodySize: 10 * 1024 * 1024,
    },
  })
    .onError(({ code, error, status }) => {
      if (code === 'NOT_FOUND') {
        return status(404, { code: -1, msg: '路由不存在' });
      }

      if (code === 'PARSE') {
        return status(400, { code: -1, msg: '请求参数解析失败' });
      }

      if (code === 'VALIDATION') {
        const msg =
          error instanceof Error
            ? isJson5Str(error.message)
              ? ((JSON5.parse(error.message) as { summary?: string }).summary ?? '请求参数校验失败')
              : error.message
            : '请求参数校验失败';

        return status(400, { code: -1, msg });
      }

      if (typeof code === 'number' || ['UNKNOWN', 'INTERNAL_SERVER_ERROR'].includes('code')) console.error(error);
      return status(500, { code: -1, msg: '服务器内部错误' });
    })
    .use(cors())
    .use(
      openapi({
        enabled: config.openapiEnable,
        path: '/docs',
      }),
    )
    .use(captchaController)
    .use(mcpController)
    .use(healthController)
    .listen(config.port);
};

const startServer = async (): Promise<void> => {
  try {
    await setupModel();
    await setupServer();

    consoleUtils.serverStartSuccess();
    consoleUtils.serverInfo();
    consoleUtils.donate();
  } catch (err) {
    consoleUtils.serverStartFail(err);
    process.exit(1);
  }
};

export { startServer };
