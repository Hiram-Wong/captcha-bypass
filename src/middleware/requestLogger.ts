import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

import dateFormat from 'dateformat';
import { Elysia } from 'elysia';
import { customAlphabet } from 'nanoid';
import { createStream, type Options as RotatingFileStreamOptions } from 'rotating-file-stream';

import { ROOT_PATH } from '@/utils/path';

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
  traceId: string;
  spanId: string;
  start: number;
};

type RfsOptions = RotatingFileStreamOptions<string, string, string>;

const CTX = Symbol('logger.ctx');

const nanoid = (size: number = 16) => customAlphabet('0123456789abcdef', size);

const getIp = (req: Request, server?: RequestIpServer | null) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  req.headers.get('x-real-ip') ||
  req.headers.get('x-client-ip') ||
  req.headers.get('cf-connecting-ip') ||
  req.headers.get('fastly-client-ip') ||
  server?.requestIP?.(req)?.address ||
  '-';

const getTraceId = (req: Request) => {
  const header = req.headers.get('x-trace-id');
  if (header) return header;

  const traceparent = req.headers.get('traceparent');
  if (traceparent) {
    const parts = traceparent.split('-');
    if (parts.length === 4 && parts[1]) return parts[1];
  }

  return nanoid(16)();
};

const getSpanId = () => nanoid(8)();

const createLogHistory = (type: string) => `.${type}_history.txt`;

const createLogGenerator = (prefix: string) => (time?: Date | number | null, index?: number) => {
  if (!time) return `${prefix}.log`;

  const date = dateFormat(time ?? new Date(), 'yyyy-mm-dd');
  return typeof index === 'undefined' || index <= 1 ? `${prefix}-${date}.log` : `${prefix}-${date}.${index}.log`;
  // return `${prefix}-${date}.log`;
};

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

  return new Elysia({ name: 'logger' })
    .onRequest(({ request }) => {
      const ctx: LoggerCtx = {
        traceId: getTraceId(request),
        spanId: getSpanId(),
        start: performance.now(),
      };

      (request as any)[CTX] = ctx;
    })

    .onAfterHandle({ as: 'global' }, ({ request, server, set }) => {
      const ctx = (request as any)[CTX] as LoggerCtx | undefined;

      const cost = ctx?.start ? performance.now() - ctx.start : 0;

      const url = new URL(request.url);

      write(accessStream, {
        time: dateFormat(new Date(), "yyyy-mm-dd'T'HH:MM:ss'Z'"),
        type: 'access',
        level: 'info',

        traceId: ctx?.traceId,
        spanId: ctx?.spanId,

        pid: process.pid,

        ip: getIp(request, server),
        method: request.method,
        path: url.pathname,
        query: url.searchParams.toString(),

        status: set.status ?? 200,
        cost: Number(cost.toFixed(3)),

        ua: request.headers.get('user-agent') || '',
        referer: request.headers.get('referer') || '',
      });
    })

    .onError({ as: 'global' }, ({ request, server, error, code }) => {
      const ctx = (request as any)[CTX] as LoggerCtx | undefined;

      const url = new URL(request.url);

      write(errorStream, {
        time: dateFormat(new Date(), "yyyy-mm-dd'T'HH:MM:ss'Z'"),
        type: 'error',
        level: 'error',

        traceId: ctx?.traceId,
        spanId: ctx?.spanId,

        pid: process.pid,

        ip: getIp(request, server),
        method: request.method,
        path: url.pathname,
        query: url.searchParams.toString(),

        code,

        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : '',
      });
    });
};
