---
name: captcha-bypass
description: This skill provides capabilities for solving CAPTCHA challenges including OCR text/math captchas, slide captchas, rotate captchas, and object detection captchas. Also provides an MCP SSE endpoint for AI agent integration. It should be used when the task involves recognizing, bypassing, or solving any type of CAPTCHA — including text-based verification codes, arithmetic captchas, slider puzzles, rotate-to-align challenges, and YOLO-based object detection. The skill wraps a local HTTP service that performs all inference on-device using ONNX models and OpenCV, no external API calls required.
---

# Captcha Bypass

## Overview

This project provides a self-hosted HTTP microservice for solving four major types of CAPTCHA challenges:
OCR text/math captchas, rotate-to-align captchas, slide/puzzle captchas, and YOLO object detection captchas. Also exposes an MCP SSE endpoint for AI agent integration. All inference runs locally using ONNX deep learning models and OpenCV.js image processing — no GPU or external API dependency.

## Quick Start

To start the service:

```bash
cp .env.example .env  # first time only
bun run dev           # or: bun src/index.ts
```

The service starts at `http://127.0.0.1:7788`. Verify with:

```bash
curl http://127.0.0.1:7788/health
# → {"status":0,"data":{"version":"1.0.8","timestamp":...},"msg":"success"}
```

If the service is already running, skip the start step and call the API directly.

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
{ "code": -1, "msg": "识别失败" }
```

**Example calls:**

```bash
# Text captcha with character filter
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' \
  -H 'Content-Type: application/json' \
  -d '{"type":"text","action":"onnx","bg":"https://example.com/captcha.png","range":"0123456789"}'

# Math captcha with range filter (improves accuracy by narrowing decoder charset)
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' \
  -H 'Content-Type: application/json' \
  -d '{"type":"math","action":"onnx","bg":"data:image/png;base64,iVBORw0KGgo...","range":"0123456789+-*/"}'

# File upload (multipart)
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' \
  -F 'type=text' \
  -F 'action=onnx' \
  -F 'bg=@captcha.png' \
  -F 'range=0123456789'
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
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' \
  -H 'Content-Type: application/json' \
  -d '{"type":"single","bg":"https://example.com/rotated.png"}'

curl -X POST 'http://127.0.0.1:7788/captcha/rotate' \
  -H 'Content-Type: application/json' \
  -d '{"type":"nox","thumb":"https://example.com/rotated.png","bg":"https://example.com/bg.png"}'
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
curl -X POST 'http://127.0.0.1:7788/captcha/slide' \
  -H 'Content-Type: application/json' \
  -d '{"type":"match","thumb":"https://example.com/slider.png","bg":"https://example.com/bg.png"}'
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
# Single-image detection
curl -X POST 'http://127.0.0.1:7788/captcha/detect' \
  -H 'Content-Type: application/json' \
  -d '{"type":"detect","bg":"https://example.com/captcha.png"}'

# Two-image match (bg as candidates, thumb as reference)
curl -X POST 'http://127.0.0.1:7788/captcha/detect' \
  -H 'Content-Type: application/json' \
  -d '{"type":"match","bg":"https://example.com/bg.png","thumb":"https://example.com/thumb.png"}'
```

### 5. MCP (Model Context Protocol) — `POST /mcp`

MCP Streamable HTTP endpoint for AI agent integration. Supports 4 tools: `ocr`, `rotate`, `slide`, `detect`.

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

No authentication required.

```json
{ "status": 0, "data": { "version": "1.0.8", "timestamp": "..." }, "msg": "success" }
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

When writing scripts that call this service, always call `GET /health` first to verify the service is running.
Use `fetch()` or `curl` to call endpoints. For file-based images, prefer the multipart upload approach:

```javascript
const form = new FormData();
form.append('type', 'text');
form.append('bg', new Blob([imageBuffer], { type: 'image/png' }), 'captcha.png');
const res = await fetch('http://127.0.0.1:7788/captcha/ocr', { method: 'POST', body: form });
const result = await res.json();
```

For in-memory Base64 images, use JSON:

```javascript
const res = await fetch('http://127.0.0.1:7788/captcha/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'text', bg: base64String }),
});
const result = await res.json();
```

## Reference

See `references/api_reference.md` for comprehensive API documentation including all parameters, response schemas, error codes, and curl examples for every endpoint and captcha type.
