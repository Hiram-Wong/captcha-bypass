import { resolve } from 'node:path';

import { Elysia } from 'elysia';

import { PUBLIC_PATH } from '@/utils/path';

export const otherController = new Elysia({ name: 'other' }).group('', (app) =>
  app
    .get(
      '/favicon.ico',
      ({ set }) => {
        set.headers['Cache-Control'] = 'public, max-age=31536000, immutable, no-transform';
        set.headers['Content-Type'] = 'image/x-icon';
        return Bun.file(resolve(PUBLIC_PATH, 'favicon.ico'));
      },
      {
        detail: { hide: true },
      },
    )
    .get(
      '/robots.txt',
      ({ set }) => {
        set.headers['Content-Type'] = 'text/plain';
        return Bun.file(resolve(PUBLIC_PATH, 'robots.txt'));
      },
      {
        detail: { hide: true },
      },
    ),
);

export default otherController;
