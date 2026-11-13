import process from 'node:process';

import { bearer } from '@elysia/bearer';
import { cors } from '@elysia/cors';
import { openapi } from '@elysia/openapi';
import { JSON5 } from 'bun';
import { Elysia } from 'elysia';
import { requestID } from 'elysia-requestid';
import { z } from 'zod';

import { initDetectCaptcha, initOcrCaptcha, initRotateCaptcha, initSlideCaptcha } from '@captcha-bypass/core';
import { config } from '@captcha-bypass/core/config';
import { APP_DESC, APP_NAME, APP_VERSION } from '@captcha-bypass/core/utils/appInfo';
import { fail } from '@captcha-bypass/core/utils/response';
import { isJSONStr, isNumber } from '@captcha-bypass/core/utils/validate';
import { isPackaged } from '@captcha-bypass/core/utils/systemInfo';
import { log } from '@captcha-bypass/core/utils/logger';

import { requestLogger } from './middleware/requestLogger';
import { captchaController } from './modules/captcha';
import { healthController } from './modules/health';
import { otherController } from './modules/other';
import consoleUtils from './utils/console';

const logger = log.withContext('SYSTEM');

const setupModels = async (): Promise<void> => {
  await Promise.all([initDetectCaptcha(), initOcrCaptcha(), initRotateCaptcha(), initSlideCaptcha()]);
};

const setupServer = async (): Promise<void> => {
  new Elysia({
    serve: {
      maxRequestBodySize: 10 * 1024 * 1024,
    },
  })
    .use(
      requestID({
        header: 'X-Request-ID',
      }),
    )
    .use(bearer())
    .use(
      cors({
        allowedHeaders: true,
        exposeHeaders: ['X-Request-ID'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        origin: true,
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
          tags: [{ name: 'captcha' }, { name: 'health' }],
        },
        path: '/docs',
        scalar: {
          defaultOpenAllTags: true,
          showDeveloperTools: false,
        },
        mapJsonSchema: {
          zod: z.toJSONSchema,
        },
      }),
    )
    // requestLogger 必须注册在 requestID 之后（从 set.headers 读取 X-Request-ID）。
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
        if (error instanceof Error && isJSONStr(error.message)) {
          const parsed = JSON5.parse(error.message) as {
            summary?: string;
            errors?: { path?: (string | number)[]; message: string }[];
          };
          const detail = parsed.errors?.[0];

          const msg =
            parsed.summary ??
            (detail ? `${detail.path?.join('.') || '(body)'}: ${detail.message}` : '请求参数校验失败');

          return status(400, fail(msg));
        }

        return status(400, fail(error instanceof Error ? error.message : '请求参数校验失败'));
      }

      if (isNumber(code) || ['UNKNOWN', 'INTERNAL_SERVER_ERROR'].includes('code')) console.error(error);
      return status(500, fail('服务器内部错误'));
    })
    .use(captchaController)
    .use(healthController)
    .use(otherController)
    .listen(config.server.port);
};

const main = async (): Promise<void> => {
  process.on('uncaughtException', (err) => {
    logger.error('未捕获异常:', err);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('Promise异常:', err);
  });

  try {
    await setupModels();
    await setupServer();

    consoleUtils.serverStartSuccess();
    consoleUtils.serverInfo();
    consoleUtils.donate();
  } catch (err) {
    consoleUtils.serverStartFail(err);
    process.exit(1);
  }
};

export { main };
