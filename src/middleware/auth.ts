import crypto from 'node:crypto';
import { Elysia } from 'elysia';

import { config } from '@/config';

const {
  auth: { key: AUTH_KEY, type: AUTH_TYPE },
} = config;

class AuthMW {
  private static instance: AuthMW | null = null;

  auth = AUTH_TYPE !== 0;
  key = AUTH_KEY;
  type = AUTH_TYPE;

  static getInstance(): AuthMW {
    if (!AuthMW.instance) {
      AuthMW.instance = new AuthMW();
    }
    return AuthMW.instance;
  }

  makeToken(): string {
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex'); // 32位随机串
    const data = `${ts}:${nonce}:${this.key}`;
    const sig = crypto.createHash('md5').update(data).digest('hex');

    return `${ts}:${nonce}:${sig}`;
  }

  verifyToken(token: string, deadline = 3): boolean {
    const parts = token.split(':');
    if (parts.length !== 3) return false;

    const [tsStr, nonce, sig] = parts;
    const ts = parseInt(tsStr, 10);
    if (Number.isNaN(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > deadline * 60) {
      return false;
    }

    const data = `${tsStr}:${nonce}:${this.key}`;

    const expectedSig = crypto.createHash('md5').update(data).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
    } catch {
      return false;
    }
  }

  middleware() {
    return new Elysia({ name: 'auth' })
      .onBeforeHandle(({ headers, status }) => {
        if (!this.auth) return;

        const authHeader = headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return status(401, { status: -1, msg: '认证失败' });
        }

        const token = authHeader.slice(7);

        try {
          const isValid = this.type === 1 ? this.key === token : this.verifyToken(token);
          if (isValid) return;

          return status(401, {
            status: -1,
            msg: '认证失败',
          });
        } catch {
          return status(401, {
            status: -1,
            msg: '认证失败',
          });
        }
      })
      .as('scoped');
  }
}

export const authMW = AuthMW.getInstance();
