import {
  solveOcrCaptcha,
  solveRotateCaptcha,
  solveSlideCaptcha,
  solveDetectionCaptcha,
} from '@/modules/captcha/service';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const SERVER_INFO = {
  name: 'captcha-bypass',
  version: '1.0.6',
};

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
          description: "Optional character filter range, e.g. '0123456789' to only recognize digits",
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
          description: 'The image to rotate as base64 string or URL (for single), or the background/reference image (for nox/tiktok)',
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

function isJsonRpcRequest(msg: unknown): msg is JsonRpcRequest {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'jsonrpc' in msg &&
    (msg as JsonRpcRequest).jsonrpc === '2.0' &&
    'method' in msg
  );
}

async function handleToolCall(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { name, arguments: args } = (req.params as { name?: string; arguments?: Record<string, string> }) || {};

  if (!name) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32602, message: 'Missing tool name' },
    };
  }

  try {
    let result: unknown;

    switch (name) {
      case 'ocr': {
        if (!args?.type || !args?.image) {
          return {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32602,
              message: 'Missing required arguments: type, image',
            },
          };
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
          return {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32602,
              message: 'Missing required arguments: type, bg',
            },
          };
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
          return {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32602,
              message: 'Missing required arguments: type, thumb, bg',
            },
          };
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
          return {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32602,
              message: 'Missing required arguments: type, bg',
            },
          };
        }
        result = await solveDetectionCaptcha({
          type: args.type as 'detect' | 'match',
          thumb: args.thumb,
          bg: args.bg,
        });
        break;
      }

      default:
        return {
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32601, message: `Unknown tool: ${name}` },
        };
    }

    return {
      jsonrpc: '2.0',
      id: req.id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false,
      },
    };
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: {
        content: [
          {
            type: 'text',
            text: err instanceof Error ? err.message : 'Tool execution failed',
          },
        ],
        isError: true,
      },
    };
  }
}

export async function processMessage(message: unknown): Promise<JsonRpcResponse | null> {
  if (!isJsonRpcRequest(message)) {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request' },
    };
  }

  const isNotification = message.id === undefined || message.id === null;

  switch (message.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };

    case 'notifications/initialized':
      return null;

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: { tools: TOOLS },
      };

    case 'tools/call':
      return handleToolCall(message);

    case 'ping':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {},
      };

    default:
      if (isNotification) return null;
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`,
        },
      };
  }
}
