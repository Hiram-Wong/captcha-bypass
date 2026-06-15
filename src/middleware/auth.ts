import crypto from 'node:crypto';

import { Elysia } from 'elysia';

import { config } from '@/config';
import { fail } from '@/utils/response';

type AuthType = 'base' | 'mcp';

const {
  auth: { key: AUTH_KEY, type: AUTH_TYPE },
} = config;
const authEnabled = AUTH_TYPE !== 0;

const verifyToken = (token: string, deadline = 3): boolean => {
  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [tsStr, nonce, sig] = parts;
  const ts = parseInt(tsStr, 10);
  if (Number.isNaN(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > deadline * 60) {
    return false;
  }

  const data = `${tsStr}:${nonce}:${AUTH_KEY}`;
  const expectedSig = crypto.createHash('md5').update(data).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
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
