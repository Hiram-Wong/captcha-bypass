import { resolve } from 'node:path';

import { file } from 'bun';
import { Elysia } from 'elysia';

import { PUBLIC_PATH } from '@/utils/path';
import { fail } from '@/utils/response';

export const otherController = new Elysia({ name: 'other' }).group('', (app) =>
  app
    .get(
      '/favicon.ico',
      async ({ set }) => {
        const assetPath = resolve(PUBLIC_PATH, 'favicon.ico');
        const assetFile = file(assetPath);
        if (!(await assetFile.exists())) {
          set.status = 404;
          return fail('favicon.ico not found');
        }

        set.headers['Cache-Control'] = 'max-age=604800';
        set.headers['Content-Type'] = 'image/x-icon';
        return assetFile;
      },
      {
        detail: { hide: true },
      },
    )
    .get(
      '/robots.txt',
      async ({ set }) => {
        const assetPath = resolve(PUBLIC_PATH, 'robots.txt');
        const assetFile = file(assetPath);
        if (!(await assetFile.exists())) {
          set.status = 404;
          return fail('robots.txt not found');
        }

        set.headers['Cache-Control'] = 'max-age=604800';
        set.headers['Content-Type'] = 'text/plain';
        return assetFile;
      },
      {
        detail: { hide: true },
      },
    ),
);

export default otherController;
