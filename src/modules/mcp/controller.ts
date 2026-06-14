import { Elysia } from 'elysia';
import { processMessage } from './service';

interface Session {
  controller: ReadableStreamDefaultController;
  createdAt: number;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const KEEP_ALIVE_MS = 15_000; // 15 seconds

const sessions = new Map<string, Session>();

// Clean up stale sessions periodically
setInterval(
  () => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.createdAt > SESSION_TIMEOUT_MS) {
        try {
          session.controller.close();
        } catch {
          /* ignore */
        }
        sessions.delete(id);
      }
    }
  },
  5 * 60 * 1000,
);

export const mcpController = new Elysia({ name: 'mcp/controller' })
  .get('/mcp', ({ request }) => {
    const sessionId = crypto.randomUUID();
    const url = new URL(request.url);
    const endpointUrl = `${url.origin}/mcp/messages?sessionId=${sessionId}`;

    let keepAliveTimer: Timer | undefined;

    const stream = new ReadableStream({
      start(controller) {
        sessions.set(sessionId, { controller, createdAt: Date.now() });

        // Send endpoint event so client knows where to POST messages
        controller.enqueue(`event: endpoint\ndata: ${endpointUrl}\n\n`);

        // Periodic keep-alive to prevent connection timeout
        keepAliveTimer = setInterval(() => {
          try {
            controller.enqueue(': ping\n\n');
          } catch {
            clearInterval(keepAliveTimer);
          }
        }, KEEP_ALIVE_MS);
      },
      cancel() {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        sessions.delete(sessionId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  })
  .post('/mcp/messages', async ({ request, set }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId || !sessions.has(sessionId)) {
      set.status = 404;
      return {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32001, message: 'Session not found' },
      };
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      set.status = 400;
      return {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      };
    }

    const session = sessions.get(sessionId)!;

    try {
      const response = await processMessage(body);
      if (response) {
        session.controller.enqueue(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
      }
    } catch (err) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: (body as { id?: unknown })?.id ?? null,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Internal error',
        },
      };
      session.controller.enqueue(`event: message\ndata: ${JSON.stringify(errorResponse)}\n\n`);
    }

    set.status = 202;
    return '';
  });

export default mcpController;
