import process from 'node:process';

import { z } from 'zod';

// ── 运行配置 ──
// 经 HTTP 调用远程服务（baseURL 为服务地址，token 为 bearer 认证）

export interface McpRuntimeConfig {
  baseURL: string;
  token: string;
  timeout: number;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:7788';
const DEFAULT_TIMEOUT_MS = 15_000;

// manifest 的 ${user_config.xxx} 占位符在未配置时可能注入字面 "undefined"/"null"，
// 或用户填写时带入前后空格/换行。先 trim 字符串，再把空值归一到 undefined，走各 schema 的 default。
const normalize = (v: unknown): unknown => {
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' || s === 'undefined' || s === 'null' ? undefined : s;
  }
  return v === undefined || v === null ? undefined : v;
};

const baseURLSchema = z.preprocess(normalize, z.string().trim().default(DEFAULT_BASE_URL));

const tokenSchema = z.preprocess(normalize, z.string().trim().default(''));

const timeoutSchema = z.preprocess((v) => {
  const nv = normalize(v);
  if (nv === undefined) return DEFAULT_TIMEOUT_MS;
  const n = Number(nv);
  return Number.isNaN(n) ? DEFAULT_TIMEOUT_MS : n;
}, z.number().int().min(1));

const parseConfig = () =>
  z
    .object({
      baseURL: baseURLSchema,
      token: tokenSchema,
      timeout: timeoutSchema,
    })
    .safeParse({
      baseURL: process.env.BASE_URL,
      token: process.env.TOKEN,
      timeout: process.env.TIMEOUT,
    });

export const loadConfig = (): McpRuntimeConfig => {
  const parsed = parseConfig();
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`MCP 配置校验失败: ${errors}`);
  }

  const { baseURL, token, timeout } = parsed.data;

  if (!baseURL) {
    throw new Error('需要指定服务地址 (BASE_URL / user_config.baseURL)');
  }

  return { baseURL, token, timeout };
};
