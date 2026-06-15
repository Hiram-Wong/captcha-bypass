import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

import { Elysia } from 'elysia';

import { ROOT_PATH } from '@/utils/path';

interface LoggerOptions {
  dir?: string;
  enabled?: boolean;
}

type LogType = 'access' | 'error';

type RequestIpServer = {
  requestIP?: (request: Request) => { address?: string } | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const nginxTime = (d: Date) => {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);

  const tz = `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    `${pad(d.getDate())}/${months[d.getMonth()]}/${d.getFullYear()}:` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${tz}`
  );
};

const nginxErrorTime = (d: Date) =>
  `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const quote = (v?: string | null) => `"${(v || '-').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const getIp = (req: Request, server?: RequestIpServer | null) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  req.headers.get('x-real-ip') ||
  req.headers.get('x-client-ip') ||
  req.headers.get('cf-connecting-ip') ||
  req.headers.get('fastly-client-ip') ||
  server?.requestIP?.(req)?.address ||
  '-';

export const logger = ({ dir = 'logs', enabled = true }: LoggerOptions = {}) => {
  if (!enabled) return new Elysia({ name: 'logger' });

  const logDir = resolve(ROOT_PATH, dir);
  mkdirSync(logDir, { recursive: true });

  const streams = new Map<LogType, { key: string; stream: WriteStream }>();

  const getStream = (type: LogType, date: Date) => {
    const key = dayKey(date);
    const cached = streams.get(type);

    if (cached?.key === key) return cached.stream;

    cached?.stream.end();

    const stream = createWriteStream(join(logDir, `${type}-${key}.log`), { flags: 'a' });

    streams.set(type, { key, stream });

    return stream;
  };

  const write = (type: LogType, line: string) => {
    const now = new Date();
    const stream = getStream(type, now);

    stream.write(line + '\n');
  };

  return new Elysia({ name: 'logger' })
    .onRequest(({ request }) => {
      (request as any)._start = performance.now();
    })

    .onAfterHandle({ as: 'global' }, ({ request, server, set }) => {
      const now = new Date();

      const start = (request as any)._start as number | undefined;
      const cost = start ? performance.now() - start : 0;

      const ip = getIp(request, server);
      const url = new URL(request.url);

      write(
        'access',
        [
          ip,
          '- -',
          `[${nginxTime(now)}]`,
          quote(`${request.method} ${url.pathname}${url.search} HTTP/1.1`),
          set.status ?? 200,
          '-',
          quote(request.headers.get('referer')),
          quote(request.headers.get('user-agent')),
          `${cost.toFixed(3)}ms`,
        ].join(' '),
      );
    })

    .onError({ as: 'global' }, ({ request, server, error, code }) => {
      const now = new Date();

      const ip = getIp(request, server);
      const url = new URL(request.url);

      const msg = error instanceof Error ? error.stack || error.message : String(error);

      write(
        'error',
        `${nginxErrorTime(now)} [error] pid=${process.pid} ${msg}, ` +
          `code=${code}, client=${ip}, request=${quote(`${request.method} ${url.pathname}${url.search}`)}`,
      );
    });
};

// export default logger;
