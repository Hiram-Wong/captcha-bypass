import { timingSafeEqual } from 'node:crypto';

import { Elysia, type Context } from 'elysia';

import { config } from '@captcha-bypass/core/config';
import { fail } from '@captcha-bypass/core/utils/response';

const AUTH_KEYS = config.auth.keys;
const authEnabled = AUTH_KEYS.length > 0;

const isValidKey = (token: string): boolean => {
  const tokenBuf = Buffer.from(token);

  return AUTH_KEYS.some((key) => {
    const keyBuf = Buffer.from(key);

    return keyBuf.length === tokenBuf.length && timingSafeEqual(keyBuf, tokenBuf);
  });
};

type AuthContext = Context<{}, { decorator: {}; store: {}; derive: { bearer?: string }; resolve: {} }>;

export const auth = () =>
  new Elysia({ name: 'auth' })
    .onBeforeHandle(({ bearer, status }: AuthContext) => {
      if (!authEnabled) return;

      try {
        if (bearer && isValidKey(bearer)) return;

        return status(401, fail('认证失败'));
      } catch {
        return status(401, fail('认证失败'));
      }
    })
    .as('scoped');
