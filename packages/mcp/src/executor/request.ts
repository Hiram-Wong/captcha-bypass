import axios from 'axios';

import type { AxiosRequestConfig } from 'axios';

import type { McpRuntimeConfig } from '../config';
import type { Executor, ExecutorInput } from './types';

export const createRequestExecutor = (config: McpRuntimeConfig): Executor => {
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: config.token ? { authorization: `Bearer ${config.token}` } : undefined,
  });

  return async <T>(input: ExecutorInput) => {
    const { url, method = 'GET', ...data } = input as AxiosRequestConfig;

    try {
      const { data: payload } = await client.request<{ code?: number; msg?: string; data?: T }>({
        url,
        method,
        ...data,
      });

      if (payload.code !== 0) throw new Error(payload.msg || '请求失败');

      return payload.data as T;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        throw new Error(`请求失败: ${err.message}`);
      }

      throw err;
    }
  };
};
