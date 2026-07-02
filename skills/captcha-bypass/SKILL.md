---
name: captcha-bypass
description: This skill provides capabilities for solving CAPTCHA challenges including OCR text/math captchas, slide captchas, rotate captchas, and object detection captchas. Supports both CLI mode (direct command-line invocation) and Server mode (HTTP API + MCP endpoint for AI agent integration). It should be used when the task involves recognizing, bypassing, or solving any type of CAPTCHA — including text-based verification codes, arithmetic captchas, slider puzzles, rotate-to-align challenges, and YOLO-based object detection. The skill runs all inference on-device using ONNX models and OpenCV, no external API calls required.
---

# Captcha Bypass

## Overview

This project provides a self-hosted service for solving four major types of CAPTCHA challenges:
OCR text/math captchas, rotate-to-align captchas, slide/puzzle captchas, and YOLO object detection captchas.
All inference runs locally using ONNX deep learning models and OpenCV.js image processing — no GPU or external API dependency.

**Two running modes** (set via `RUN_MODE` env, code default `cli`):

- **CLI mode** — Direct command-line invocation, outputs JSON to stdout. Best for scripting and one-shot recognition.
- **Server mode** — HTTP API on `http://127.0.0.1:7788` with REST endpoints and an MCP endpoint for AI agent integration.

> The code default is `cli`. The bundled `.env.example` sets `RUN_MODE=server`, and any copied `.env` value takes priority over the code default. Check `.env` to verify the actual mode.

## Quick Start

### CLI Mode

To use CLI mode, ensure `.env` does NOT set `RUN_MODE=server`, or override on the command line:

```bash
# Ensure CLI mode (overrides .env)
# macOS / Linux:
RUN_MODE=cli ./captcha-bypass ocr --type text --bg ./captcha.png
# Windows:
set RUN_MODE=cli && .\captcha-bypass.exe ocr --type text --bg ./captcha.png

# Or simply remove/comment RUN_MODE from .env,
# then run commands directly:
./captcha-bypass ocr --type text --bg ./captcha.png
./captcha-bypass ocr --type math --bg ./captcha.png --action ai
./captcha-bypass slide --type match --bg ./bg.png --thumb ./slider.png
./captcha-bypass --help
```
> **Platform**: On **Windows**, replace `./captcha-bypass` with `.\captcha-bypass.exe`, and use `set VAR=val && ...` instead of `VAR=val ...` for environment variables.

Images support local file path, HTTP URL, and Base64 input.

### Server Mode

If `.env` has `RUN_MODE=server`, the binary starts as HTTP service:

```bash
bun run dev           # or: bun src/index.ts
```

Verify with:

```bash
curl http://127.0.0.1:7788/health
# → {"status":0,"data":{"name":"captcha-bypass","homepage":"https://github.com/Hiram-Wong/captcha-bypass","version":"x.x.x","timestamp":...},"msg":"success"}
```

## API Endpoints

### 1. OCR Captcha — `POST /captcha/ocr`

Recognize text-based or arithmetic CAPTCHA images.

**Request body (JSON):**

| Field    | Type               | Required | Description                                                           |
| -------- | ------------------ | -------- | --------------------------------------------------------------------- |
| `type`   | `"text" \| "math"` | Yes      | `text` for text captcha, `math` for arithmetic captcha                |
| `bg`     | `string \| File`   | Yes      | Image input: Base64 string, HTTP(S) URL, or uploaded file (multipart) |
| `action` | `"ai" \| "onnx"`   | No       | Recognition engine: `onnx` uses local ONNX model (default), `ai` uses LLM vision API for text extraction |
| `range`  | `string`           | No       | Character set filter. Narrows recognition to specific characters, e.g. `"0123456789"` for digits, `"0123456789+-*/"` for math. Works for both `text` and `math` types. |

**Response:**

```json
// type=text:
{ "status": 0, "data": { "code": "AB3D" }, "msg": "success" }

// type=math:
{ "status": 0, "data": { "formula": "41*8", "result": 328 }, "msg": "success" }

// error:
{ "code": -1, "msg": "Recognition failed" }
```

**Example calls:**

```bash
# === Server mode (curl) ===
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' \
  -H 'Content-Type: application/json' \
  -d '{"type":"text","action":"onnx","bg":"https://example.com/captcha.png","range":"0123456789"}'

# === CLI mode ===
./captcha-bypass ocr --type text --bg https://example.com/captcha.png --range 0123456789
./captcha-bypass ocr --type math --bg ./captcha.png --action ai
```


### 2. Rotate Captcha — `POST /captcha/rotate`

Determine the rotation angle needed to align a rotated image.

**Request body (JSON):**

| Field   | Type                            | Required                                                 | Description                                                                                                                                                   |
| ------- | ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`  | `"single" \| "nox" \| "tiktok"` | Yes                                                      | `single`: single-image rotation correction (Baidu/Xiaohongshu style). `nox`: two-image template matching. `tiktok`: two-circle color matching (Douyin style). |
| `bg`    | `string \| File`                | Yes                                                      | Image to rotate (single), or background/reference image (nox/tiktok)                                                                                          |
| `thumb` | `string \| File`                | Required for `nox` and `tiktok`; not needed for `single` | Foreground/rotated image for comparison                                                                                                                       |

**Response:**

```json
{ "status": 0, "data": { "cw": 253, "ccw": 107 }, "msg": "success" }
```

- `cw`: clockwise rotation angle (degrees)
- `ccw`: counter-clockwise rotation angle (degrees)

**Example calls:**

```bash
# === Server mode (curl) ===
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' \
  -H 'Content-Type: application/json' \
  -d '{"type":"single","bg":"https://example.com/rotated.png"}'

# === CLI mode ===
./captcha-bypass rotate --type single --bg ./rotated.png
./captcha-bypass rotate --type nox --bg ./bg.png --thumb ./thumb.png
```

### 3. Slide Captcha — `POST /captcha/slide`

Find the position where a slider piece fits into a background image.

**Request body (JSON):**

| Field   | Type                   | Required | Description                                                                           |
| ------- | ---------------------- | -------- | ------------------------------------------------------------------------------------- |
| `type`  | `"match" \| "compare"` | Yes      | `match`: template matching via edge detection. `compare`: difference-based detection. |
| `thumb` | `string \| File`       | Yes      | Slider piece image                                                                    |
| `bg`    | `string \| File`       | Yes      | Background image with gap                                                             |

**Response:**

```json
{ "status": 0, "data": { "x": 214, "y": 0 }, "msg": "success" }
```

- `x`: horizontal offset (pixels from left)
- `y`: vertical offset (pixels from top)

**Example calls:**

```bash
# === Server mode (curl) ===
curl -X POST 'http://127.0.0.1:7788/captcha/slide' \
  -H 'Content-Type: application/json' \
  -d '{"type":"match","thumb":"https://example.com/slider.png","bg":"https://example.com/bg.png"}'

# === CLI mode ===
./captcha-bypass slide --type match --bg ./bg.png --thumb ./slider.png
```

### 4. Detection Captcha — `POST /captcha/detect`

Detect objects in captcha images using YOLO-style object detection, or match thumb objects to background. Supports two modes: `detect` (single image) and `match` (two-image Hungarian matching).

**Request body (JSON):**

| Field   | Type                        | Required | Description                                 |
| ------- | --------------------------- | -------- | ------------------------------------------- |
| `type`  | `"detect" \| "match"`       | Yes      | `detect`: single-image detection. `match`: match thumb to bg. |
| `bg`    | `string \| File`            | Yes      | Image to detect / background for match       |
| `thumb` | `string \| File`            | No       | Reference image (required for `match`)       |

**Response:**

```json
{
  "status": 0,
  "data": [
    {
      "target": "data:image/png;base64,...",
      "coordinate": { "x1": 10, "y1": 20, "x2": 50, "y2": 60 }
    }
  ],
  "msg": "success"
}
```

- `target`: Base64 cropped image of the detected/matched object.
- `coordinate`: Bounding box with `x1`, `y1` (top-left) and `x2`, `y2` (bottom-right) coordinates.

**Example calls:**

```bash
# === Server mode (curl) ===
curl -X POST 'http://127.0.0.1:7788/captcha/detect' \
  -H 'Content-Type: application/json' \
  -d '{"type":"detect","bg":"https://example.com/captcha.png"}'

# === CLI mode ===
./captcha-bypass detect --type detect --bg ./captcha.png
./captcha-bypass detect --type match --bg ./bg.png --thumb ./thumb.png
```

### 5. MCP (Model Context Protocol) — `POST /mcp`

> Server mode only. MCP Streamable HTTP endpoint for AI agent integration. Supports 4 tools: `ocr`, `rotate`, `slide`, `detect`.

**Usage (single endpoint, no SSE, no sessions):**

```bash
# 1. Initialize
curl -X POST 'http://127.0.0.1:7788/mcp' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"client","version":"1.0"}}}'

# 2. Call a tool — response returned directly in HTTP body
curl -X POST 'http://127.0.0.1:7788/mcp' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ocr","arguments":{"type":"text","bg":"https://example.com/captcha.png","action":"onnx","range":"0123456789"}}}'
# → {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"..."}]}}
```

### 6. Health Check — `GET /health`

No authentication required. Returns service metadata including app name, homepage, version, and current timestamp.

```json
{ "status": 0, "data": { "name": "captcha-bypass", "homepage": "https://github.com/Hiram-Wong/captcha-bypass", "version": "1.0.9", "timestamp": 1781719500449 }, "msg": "success" }
```

## Image Input Formats

All endpoints support three ways to provide images:

1. **Base64 string** — raw base64 (auto-prefixed as `data:image/png;base64,...`) or with full data URI prefix
2. **HTTP(S) URL** — the service downloads the image (10-second timeout)
3. **File upload** — multipart/form-data with an image file

## Authentication

If `AUTH_TYPE` is set to non-zero in `.env`, include an `Authorization` header:

```bash
# AUTH_TYPE=1 (fixed token)
curl -H 'Authorization: Bearer <AUTH_KEY>' ...

# AUTH_TYPE=2 (timestamp signature, valid 3 minutes)
# Generate token via: bun run generate:token
curl -H 'Authorization: Bearer <ts:nonce:signature>' ...
```

Check `AUTH_TYPE` in `.env` first. If `AUTH_TYPE=0`, no auth header is needed.

## Tips for Calling from Code

When writing scripts that call this service:

- **CLI mode**: Use `child_process` or shell to invoke the binary and parse stdout JSON. Best for simple one-shot calls.
- **Server mode**: Call the HTTP API. Always check `GET /health` first to verify the service is running.

**CLI mode (Node.js/Bun):**

```javascript
import { spawnSync } from 'node:child_process';
const result = spawnSync('./captcha-bypass', ['ocr', '--type', 'text', '--bg', './captcha.png']);
console.log(JSON.parse(result.stdout.toString()));
// → { code: "AB3D" }
```

**Server mode (fetch):**

```javascript
// For file-based images, prefer multipart upload:
const form = new FormData();
form.append('type', 'text');
form.append('bg', new Blob([imageBuffer], { type: 'image/png' }), 'captcha.png');
const res = await fetch('http://127.0.0.1:7788/captcha/ocr', { method: 'POST', body: form });
const result = await res.json();

// For in-memory Base64 images, use JSON:
const res = await fetch('http://127.0.0.1:7788/captcha/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'text', bg: base64String }),
});
const result = await res.json();
```

## Reference

See `references/api_reference.md` for comprehensive API documentation including all parameters, response schemas, error codes, and curl examples for every endpoint and captcha type.
