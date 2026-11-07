import process from 'node:process';

import pkg from '../../../package.json' with { type: 'json' };

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { loadConfig } from './config';
import { createExecutor, type Executor } from './executor';
import { captchaController } from './tools/captcha';
import { healthController } from './tools/health';

export const createServer = (executor: Executor): McpServer => {
  const server = new McpServer(
    {
      name: pkg.name,
      version: pkg.version,
    },
    { capabilities: { tools: {} } },
  );

  captchaController(server, executor);
  healthController(server, executor);

  return server;
};

export const main = async (): Promise<void> => {
  const executor = createExecutor(loadConfig());
  await serveStdio(() => createServer(executor));
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
