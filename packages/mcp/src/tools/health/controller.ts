import type { McpServer } from '@modelcontextprotocol/server';

import { z } from 'zod';

import type { Executor } from '../../executor';
import { createToolCall } from '../../utils/tool';

export function healthController(server: McpServer, executor: Executor): void {
  server.registerTool(
    'health',
    {
      title: 'Health Check',
      description:
        'Check the remote captcha-bypass service health. Returns service name, version, homepage and server timestamp if the service is reachable.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    createToolCall(() => executor({ url: '/health', method: 'GET' })),
  );
}

export default healthController;
