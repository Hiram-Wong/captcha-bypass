import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

import dateFormat from 'dateformat';
import { Elysia } from 'elysia';
import { createStream, type Options as RotatingFileStreamOptions } from 'rotating-file-stream';

import { ROOT_PATH } from '@captcha-bypass/core/utils/path';
import { isUndefined } from '@captcha-bypass/core/utils/validate';

interface LoggerOptions {
  dir?: string;
  enabled?: boolean;
  maxFiles?: RotatingFileStreamOptions['maxFiles'];
  teeToStdout?: RotatingFileStreamOptions['teeToStdout'];
}

type RequestIpServer = {
  requestIP?: (request: Request) => { address?: string } | null;
};

type LoggerCtx = {
  start: number;
};

type RfsOptions = RotatingFileStreamOptions<string, string, string>;

const CTX = Symbol('logger.ctx');
const REQUEST_ID_HEADER = 'X-Request-ID';

const createLogHistory = (type: string) => `.${type}_history.txt`;

const createLogGenerator = (prefix: string) => (time?: Date | number | null, index?: number) => {
  if (!time) return `${prefix}.log`;

  const date = dateFormat(time ?? new Date(), 'yyyy-mm-dd');
  return isUndefined(index) || index <= 1 ? `${prefix}-${date}.log` : `${prefix}-${date}.${index}.log`;
  // return `${prefix}-${date}.log`;
};

const safeParseUrl = (raw: string) => {
  try {
    return new URL(raw, 'http://localhost:7788');
  } catch {
    return null;
  }
};

const getIp = (req: Request, server?: RequestIpServer | null) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  req.headers.get('x-real-ip') ||
  req.headers.get('x-client-ip') ||
  req.headers.get('cf-connecting-ip') ||
  req.headers.get('fastly-client-ip') ||
  server?.requestIP?.(req)?.address ||
  '-';

export const requestLogger = (options: LoggerOptions = {}) => {
  const { enabled = true, dir = 'logs', maxFiles = 7, teeToStdout = false } = options;
  const logDir = resolve(ROOT_PATH, dir);

  if (!enabled) return new Elysia({ name: 'requestLogger' });

  const rfsOptions: RfsOptions = {
    interval: '1d',
    intervalBoundary: true,
    maxFiles,
    path: logDir,
    teeToStdout,
  };

  const accessHistoryFile = createLogHistory('access');
  const errorHistoryFile = createLogHistory('error');

  const accessStream = createStream(createLogGenerator('access'), {
    ...rfsOptions,
    history: accessHistoryFile,
  });
  const errorStream = createStream(createLogGenerator('error'), {
    ...rfsOptions,
    history: errorHistoryFile,
  });

  const write = (stream: NodeJS.WritableStream, obj: unknown) => {
    stream.write(JSON.stringify(obj) + '\n');
  };

  const getRequestId = (_request: Request, set: { headers?: Record<string, unknown> }) => {
    const id = set.headers?.[REQUEST_ID_HEADER];
    return id;
  };

  return new Elysia({ name: 'logger' })
    .onRequest(({ request }) => {
      (request as any)[CTX] = {
        start: performance.now(),
      } satisfies LoggerCtx;
    })

    .onAfterResponse({ as: 'global' }, ({ path, request, server, set }) => {
      const ctx = (request as any)[CTX] as LoggerCtx | undefined;
      const cost = ctx?.start ? performance.now() - ctx.start : 0;

      const url = safeParseUrl(request.url);

      write(accessStream, {
        time: dateFormat(new Date(), "yyyy-mm-dd'T'HH:MM:ss'Z'"),
        type: 'access',
        level: 'info',

        requestId: getRequestId(request, set),

        pid: process.pid,

        ip: getIp(request, server),
        method: request.method,
        path,
        query: url?.searchParams?.toString() || '',

        status: set.status ?? 200,
        cost: Number(cost.toFixed(3)),

        ua: request.headers.get('user-agent') || '',
        referer: request.headers.get('referer') || '',
      });
    })

    .onError({ as: 'global' }, ({ path, request, server, set, error, code }) => {
      const url = safeParseUrl(request.url);

      write(errorStream, {
        time: dateFormat(new Date(), "yyyy-mm-dd'T'HH:MM:ss'Z'"),
        type: 'error',
        level: 'error',

        requestId: getRequestId(request, set),

        pid: process.pid,

        ip: getIp(request, server),
        method: request.method,
        path,
        query: url?.searchParams?.toString() || '',

        code,

        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : '',
      });
    });
};
