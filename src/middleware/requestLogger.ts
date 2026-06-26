import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

const createLogGenerator = (prefix: string) => (time?: Date | number | null, _index?: number) => {
  const date = dateFormat(time ?? new Date(), 'yyyy-mm-dd');
  return `${prefix}-${date}.log`;
  // return typeof index === 'undefined' || index <= 1 ? `${prefix}-${date}.log` : `${prefix}-${date}.${index}.log`;
};

const initHistory = (logDir: string, fileName: string, prefix: string): void => {
  const historyPath = resolve(logDir, fileName);
  const currentLog = resolve(logDir, createLogGenerator(prefix)());

  if (!existsSync(historyPath)) {
    writeFileSync(historyPath, currentLog + '\n');
    return;
  }

  const lines = readFileSync(historyPath, 'utf-8').trim().split('\n').filter(Boolean);
  if (lines.includes(currentLog)) return;

  writeFileSync(historyPath, [...lines, currentLog].join('\n') + '\n');
};

export const requestLogger = ({ dir = 'logs', enabled = true, teeToStdout = false }: LoggerOptions = {}) => {
  if (!enabled) return new Elysia({ name: 'requestLogger' });

  const logDir = resolve(ROOT_PATH, dir);

  const rfsOptions: RfsOptions = {
    interval: '1d',
    intervalBoundary: true,
    maxFiles: 7,
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

  accessStream.on('open', () => initHistory(logDir, accessHistoryFile, 'access'));
  errorStream.on('open', () => initHistory(logDir, errorHistoryFile, 'error'));

  const write = (stream: NodeJS.WritableStream, obj: unknown) => {
    const ok = stream.write(JSON.stringify(obj) + '\n');
    if (!ok) stream.once('drain', () => {});
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
      const now = new Date();
      const ctx = (request as any)[CTX] as LoggerCtx | undefined;

      const cost = ctx?.start ? performance.now() - ctx.start : 0;

      const url = new URL(request.url);

      write(accessStream, {
        time: now.toISOString(),
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
      const now = new Date();
      const ctx = (request as any)[CTX] as LoggerCtx | undefined;

      const url = new URL(request.url);

      write(errorStream, {
        time: now.toISOString(),
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
