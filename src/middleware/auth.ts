import { timingSafeEqual } from 'node:crypto';

import { CryptoHasher } from 'bun';
import { Elysia } from 'elysia';

import { config } from '@/config';
import { fail } from '@/utils/response';

type AuthType = 'base' | 'mcp';

const {
  auth: { key: AUTH_KEY, type: AUTH_TYPE },
} = config;
const authEnabled = AUTH_TYPE !== 0;

const verifyToken = (token: string, deadline = 3): boolean => {
  const [tsStr, nonce, sig] = token.split(':');
  if (!tsStr || !nonce || !sig) return false;
  if (nonce.length !== 32) return false;

  const ts = +tsStr;
  if (Number.isNaN(ts) || Math.abs((Date.now() / 1000 - ts) | 0) > deadline * 60) return false;

  const expected = new CryptoHasher('md5').update(`${tsStr}:${nonce}:${AUTH_KEY}`).digest();
  const actual = Buffer.from(sig, 'hex');

  try {
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};

const createAuth = (type: AuthType = 'base') =>
  new Elysia({ name: `auth-${type}` })
    .onBeforeHandle(({ headers, status }) => {
      if (!authEnabled) return;

      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return status(401, fail('认证失败'));
      }

      const token = authHeader.slice(7);

      try {
        const isValid = type === 'mcp' ? AUTH_KEY === token : AUTH_TYPE === 1 ? AUTH_KEY === token : verifyToken(token);
        if (isValid) return;

        return status(401, fail('认证失败'));
      } catch {
        return status(401, fail('认证失败'));
      }
    })
    .as('scoped');

export const auth = () => createAuth('base');
export const mcpAuth = () => createAuth('mcp');
