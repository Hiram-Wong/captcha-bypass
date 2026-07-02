import process from 'node:process';

import { cors } from '@elysia/cors';
import { openapi } from '@elysia/openapi';
import { JSON5, main } from 'bun';
import { Elysia } from 'elysia';

import { BaseCvService } from '@/captcha/base/cv';
import { detectCaptchaService } from '@/captcha/detect';
import { ocrCaptchaService } from '@/captcha/ocr';
import { rotateCaptchaService } from '@/captcha/rotate';
import { config } from '@/config';
import { requestLogger } from '@/middleware/requestLogger';
import { captchaController } from '@/modules/captcha';
import { healthController } from '@/modules/health';
import { mcpController } from '@/modules/mcp';
import { otherController } from '@/modules/other';
import { APP_DESC, APP_NAME, APP_VERSION } from '@/utils/appInfo';
import consoleUtils from '@/utils/console';
import { log } from '@/utils/logger';
import { fail } from '@/utils/response';
import { isPackaged } from '@/utils/systemInfo';
import { isJsonStr } from '@/utils/validate';

const logger = log.withContext('SYSTEM');

process.on('uncaughtException', (err) => {
  logger.error('未捕获异常:', err);
});

process.on('unhandledRejection', (err) => {
  logger.error('Promise异常:', err);
});

const setupModel = async (): Promise<void> => {
  await BaseCvService.init();
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
        enabled: config.server.openapiEnable,
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
      requestLogger({
        dir: 'logs',
        enabled: isPackaged,
        maxFiles: 7,
        // teeToStdout: !isPackaged,
      }),
    )
    .onError(({ code, error, status }) => {
      if (code === 'NOT_FOUND') {
        return status(404, fail('路由不存在'));
      }

      if (code === 'PARSE') {
        return status(400, fail('请求参数解析失败'));
      }

      if (code === 'VALIDATION') {
        const msg =
          error instanceof Error
            ? isJsonStr(error.message)
              ? ((JSON5.parse(error.message) as { summary?: string }).summary ?? '请求参数校验失败')
              : error.message
            : '请求参数校验失败';

        return status(400, fail(msg));
      }

      if (typeof code === 'number' || ['UNKNOWN', 'INTERNAL_SERVER_ERROR'].includes('code')) console.error(error);
      return status(500, fail('服务器内部错误'));
    })
    .use(captchaController)
    .use(mcpController)
    .use(healthController)
    .use(otherController)
    .listen(config.server.port);
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

if (import.meta.path === main || isPackaged) {
  void startServer();
}

export { startServer };
