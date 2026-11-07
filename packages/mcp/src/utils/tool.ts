import type { CallToolResult } from '@modelcontextprotocol/server';

export const createTextContent = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
});

export const createToolCall =
  (call: (args: Record<string, unknown>) => Promise<unknown>) =>
  async (args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      return createTextContent(JSON.stringify(await call(args), null, 2));
    } catch (err) {
      return { ...createTextContent(err instanceof Error ? err.message : 'Tool execution failed'), isError: true };
    }
  };
