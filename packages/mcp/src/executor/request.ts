import axios from 'axios';

import type { AxiosRequestConfig } from 'axios';

import type { McpRuntimeConfig } from '../config';
import type { Executor, ExecutorInput, ExecutorOutput } from './types';

type RequestInput = {
  url: string;
  method?: AxiosRequestConfig['method'];
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
};

export const createRequestExecutor = (config: McpRuntimeConfig): Executor => {
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: config.token ? { authorization: `Bearer ${config.token}` } : undefined,
  });

  return async <T>(input: ExecutorInput) => {
    const { url, method = 'GET', headers, params, data: body, timeout } = input as RequestInput;

    try {
      const { data: payload } = await client.request<ExecutorOutput<T>>({
        url,
        method,
        headers,
        params,
        data: body,
        timeout,
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
