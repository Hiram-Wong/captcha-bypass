import process from 'node:process';

import { cors } from '@elysia/cors';
import { openapi } from '@elysia/openapi';
import { JSON5 } from 'bun';
import { Elysia } from 'elysia';

import { detectCaptchaService } from '@/captcha/detect';
import { ocrCaptchaService } from '@/captcha/ocr';
import { rotateCaptchaService } from '@/captcha/rotate';
import { config } from '@/config';
import { logger } from '@/middleware/logger';
import { captchaController } from '@/modules/captcha';
import { healthController } from '@/modules/health';
import { mcpController } from '@/modules/mcp';
import { APP_DESC, APP_NAME, APP_VERSION } from '@/utils/appInfo';
import consoleUtils from '@/utils/console';
import { isPackaged } from '@/utils/systemInfo';
import { isJsonStr } from '@/utils/validate';

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
    .use(
      cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      }),
    )
    .use(
      openapi({
        enabled: config.openapiEnable,
        documentation: {
          info: {
            title: `${APP_NAME} API`,
            version: APP_VERSION,
            description: APP_DESC,
          },
          tags: [{ name: 'captcha' }, { name: 'mcp' }, { name: 'health' }],
        },
        path: '/docs',
        scalar: {
          defaultOpenAllTags: true,
          showDeveloperTools: false,
        },
      }),
    )
    .use(
      logger({
        enabled: isPackaged,
        dir: 'logs',
      }),
    )
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
            ? isJsonStr(error.message)
              ? ((JSON5.parse(error.message) as { summary?: string }).summary ?? '请求参数校验失败')
              : error.message
            : '请求参数校验失败';

        return status(400, { code: -1, msg });
      }

      if (typeof code === 'number' || ['UNKNOWN', 'INTERNAL_SERVER_ERROR'].includes('code')) console.error(error);
      return status(500, { code: -1, msg: '服务器内部错误' });
    })
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
