import {
  solveOcrCaptcha,
  solveRotateCaptcha,
  solveSlideCaptcha,
  solveDetectionCaptcha,
} from '@/modules/captcha/service';
import { isJsonRpcV2 } from '@/utils/validate';

// ── JSON-RPC 2.0 errors ──

/**
 * JSON-RPC 2.0 standard error codes (spec-defined).
 * @see https://www.jsonrpc.org/specification#error_object
 */
export const JsonRpcError = {
  PARSE_ERROR: { code: -32700 as const, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600 as const, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601 as const, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602 as const, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603 as const, message: 'Internal error' },
};

/**
 * MCP application-level errors.
 * Server error range reserved: -32000 to -32099.
 */
const McpError = {
  sessionNotFound: { code: -32001 as const, message: 'Session not found' },
  toolNotFound: (name: string) => ({ code: -32601 as const, message: `Unknown tool: ${name}` }),
  missingParams: (required: string) => ({ code: -32602 as const, message: `Missing required arguments: ${required}` }),
  missingToolName: { code: -32602 as const, message: 'Missing tool name' },
  toolFailed: (reason: string) => ({ code: -32603 as const, message: reason }),
};

// ── JSON-RPC 2.0 types ──

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | {
      jsonrpc: '2.0';
      id: string | number | null;
      result: unknown;
    }
  | {
      jsonrpc: '2.0';
      id: string | number | null;
      error: {
        code: number;
        message: string;
        data?: unknown;
      };
    };

// ── JSON-RPC response builders ──

export const rpc = {
  success(id: string | number | null | undefined, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id: id ?? null, result };
  },

  error(
    id: string | number | null | undefined,
    error: { code: number; message: string; data?: unknown },
  ): JsonRpcResponse {
    return { jsonrpc: '2.0', id: id ?? null, error };
  },

  /** Pre-built parse error (no request body could be parsed). */
  parseError(): JsonRpcResponse {
    return { jsonrpc: '2.0', id: null, error: JsonRpcError.PARSE_ERROR };
  },
};

// ── server info ──

const SERVER_INFO = {
  name: 'captcha-bypass',
  version: '1.0.6',
};

// ── tool definitions ──

const TOOLS = [
  {
    name: 'ocr',
    description:
      'Recognize text or math formula from captcha images. Supports both text OCR and math formula recognition.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['text', 'math'],
          description: "Recognition type: 'text' for character recognition, 'math' for math formula recognition",
        },
        image: {
          type: 'string',
          description: 'Image as base64 string (with or without data URI prefix) or image URL',
        },
        range: {
          type: 'string',
          description: "Optional character set filter, e.g. '0123456789' to only recognize digits, '0123456789+-*/' for math captcha.",
        },
      },
      required: ['type', 'image'],
    },
  },
  {
    name: 'rotate',
    description:
      'Detect rotation angle of captcha images. Supports single image rotation detection and double image comparison (nox/tiktok).',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['single', 'nox', 'tiktok'],
          description:
            "Detection type: 'single' for single image rotation, 'nox' for two-image comparison, 'tiktok' for TikTok-style rotation",
        },
        bg: {
          type: 'string',
          description:
            'The image to rotate as base64 string or URL (for single), or the background/reference image (for nox/tiktok)',
        },
        thumb: {
          type: 'string',
          description: 'The foreground/rotated image as base64 string or URL (required for nox and tiktok types)',
        },
      },
      required: ['type', 'bg'],
    },
  },
  {
    name: 'slide',
    description:
      'Match slider captcha position by comparing slider image with background image. Returns the x,y coordinates of the best match.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['match', 'compare'],
          description: "Match type: 'match' for template matching (Canny + TM), 'compare' for difference comparison",
        },
        thumb: {
          type: 'string',
          description: 'The slider/thumb image as base64 string or URL',
        },
        bg: {
          type: 'string',
          description: 'The background image as base64 string or URL',
        },
      },
      required: ['type', 'thumb', 'bg'],
    },
  },
  {
    name: 'detect',
    description:
      'Detect objects in captcha images using YOLO-style target detection, or match thumb objects to a background using Hungarian algorithm. Returns an array of {target, coordinate} where target is a base64 cropped image of each detected object.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['detect', 'match'],
          description: "'detect' for single-image detection, 'match' for two-image Hungarian matching",
        },
        bg: {
          type: 'string',
          description:
            'The image to detect objects in, or the background/candidate image for matching, as base64 string or URL',
        },
        thumb: {
          type: 'string',
          description: 'The reference image for matching (required for type=match)',
        },
      },
      required: ['type', 'bg'],
    },
  },
];

// ── tool call handler ──

async function handleToolCall(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { name, arguments: args } = (req.params as { name?: string; arguments?: Record<string, string> }) || {};

  if (!name) {
    return rpc.error(req.id, McpError.missingToolName);
  }

  try {
    let result: unknown;

    switch (name) {
      case 'ocr': {
        if (!args?.type || !args?.image) {
          return rpc.error(req.id, McpError.missingParams('type, image'));
        }
        result = await solveOcrCaptcha({
          type: args.type as 'text' | 'math',
          bg: args.image,
          range: args.range,
        });
        break;
      }

      case 'rotate': {
        if (!args?.type || !args?.bg) {
          return rpc.error(req.id, McpError.missingParams('type, bg'));
        }
        result = await solveRotateCaptcha({
          type: args.type as 'single' | 'nox' | 'tiktok',
          thumb: args.thumb,
          bg: args.bg,
        });
        break;
      }

      case 'slide': {
        if (!args?.type || !args?.thumb || !args?.bg) {
          return rpc.error(req.id, McpError.missingParams('type, thumb, bg'));
        }
        result = await solveSlideCaptcha({
          type: args.type as 'match' | 'compare',
          thumb: args.thumb,
          bg: args.bg,
        });
        break;
      }

      case 'detect': {
        if (!args?.type || !args?.bg) {
          return rpc.error(req.id, McpError.missingParams('type, bg'));
        }
        result = await solveDetectionCaptcha({
          type: args.type as 'detect' | 'match',
          thumb: args.thumb,
          bg: args.bg,
        });
        break;
      }

      default:
        return rpc.error(req.id, McpError.toolNotFound(name));
    }

    return rpc.success(req.id, {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: false,
    });
  } catch (err) {
    return rpc.success(req.id, {
      content: [
        {
          type: 'text',
          text: err instanceof Error ? err.message : 'Tool execution failed',
        },
      ],
      isError: true,
    });
  }
}

// ── MCP message dispatcher ──

export async function handleMcpMessage(message: unknown): Promise<JsonRpcResponse> {
  if (!isJsonRpcV2(message)) {
    return rpc.error(null, JsonRpcError.INVALID_REQUEST);
  }

  const isNotification = message.id === undefined || message.id === null;

  switch (message.method) {
    case 'initialize':
      return rpc.success(message.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case 'notifications/initialized':
      return rpc.success(null, {});

    case 'tools/list':
      return rpc.success(message.id, { tools: TOOLS });

    case 'tools/call':
      return handleToolCall(message);

    case 'ping':
      return rpc.success(message.id, {});

    default:
      if (isNotification) return rpc.success(null, {});
      return rpc.error(message.id, {
        ...JsonRpcError.METHOD_NOT_FOUND,
        message: `Method not found: ${message.method}`,
      });
  }
}
