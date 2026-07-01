# Captcha Bypass API Reference

## Service Configuration

| Env Variable         | Type    | Default     | Description                                                     |
| -------------------- | ------- | ----------- | --------------------------------------------------------------- |
| `RUN_MODE`           | string  | cli         | Running mode<br>`cli` (command line) or `server` (HTTP API)      |
| `NODE_ENV`           | string  | development | `development`, or `production`                                  |
| `LOG_LEVEL`          | string  | info        | Log level<br>`silly` < `debug` < `info` < `warn` < `error`      |
| `PORT`               | number  | 7788        | Service port (server mode only)                                  |
| `OPENAPI_ENABLE`     | boolean | false       | Enable Swagger UI at `/docs`                                    |
| `AUTH_TYPE`          | 0\|1\|2 | 0           | Auth type<br>0=disabled, 1=fixed token, 2=timestamp signature (3-min expiry) |
| `AUTH_KEY`           | string  | ""          | Auth key<br>Used when AUTH_TYPE=1 or 2                          |
| `DETECT_MODEL_PATH`  | string  | ""          | Detect model path<br>Defaults to `models/detect.onnx` if empty  |
| `OCR_MODEL_PATH`     | string  | ""          | OCR model path<br>Defaults to `models/ocr.onnx` if empty        |
| `OCR_CHARSET_PATH`   | string  | ""          | OCR charset file path<br>Defaults to `models/ocr.json` if empty |
| `OCR_CHARSET_RANGES` | string  | ""          | Global charset filter<br>e.g. `"0123456789"`                     |
| `ROTATE_MODEL_PATH`  | string  | ""          | Rotate model path<br>Defaults to `models/rotate.onnx` if empty  |
| `OPENAI_BASE_URL`    | string  | ""          | OpenAI API base URL<br>Only `/chat/completions` supported |
| `OPENAI_API_KEY`     | string  | ""          | OpenAI API key                                                  |
| `OPENAI_OCR_MODEL`   | string  | PaddleOCR-VL-1.6 | OCR-specific model name<br>Recommended: PaddleOCR, DeepSeek-OCR, HunyuanOCR |
| `OPENAI_MODEL`       | string  | gpt-5.5     | General model name                                                |

## Endpoints

### `GET /health`

No authentication required. Returns service health and version.

**Success response (200):**

```json
{
  "status": 0,
  "data": {
    "name": "captcha-bypass",
    "homepage": "https://github.com/Hiram-Wong/captcha-bypass",
    "version": "1.0.9",
    "timestamp": 1781719500449
  },
  "msg": "success"
}
```

---

### `POST /captcha/ocr`

Recognize text-based or arithmetic CAPTCHA images.

**Authentication**: Required if AUTH_TYPE ≠ 0 (Bearer token).

**Content-Type**: `application/json` or `multipart/form-data`

**Request schema:**

| Field    | Type                 | Required | Description                                                                                                                                                                     |
| -------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`   | `"text"` \| `"math"` | Yes      | CAPTCHA type                                                                                                                                                                    |
| `bg`     | string \| File       | Yes      | Image as Base64, URL, or uploaded file                                                                                                                                          |
| `action` | `"ai"` \| `"onnx"`   | No       | Recognition engine: `onnx` uses local ONNX model (default, fast), `ai` uses LLM vision API for text extraction (higher accuracy for complex text captchas)                      |
| `range`  | string               | No       | Character set filter. Narrows recognition to the specified characters only. Works for both `text` and `math` types. Example: `"0123456789"` for digits, `"0123456789+-*/"` for math expressions. |

**Success response (200):**

Text type:

```json
{
  "status": 0,
  "data": { "code": "AB3D" },
  "msg": "success"
}
```

Math type:

```json
{
  "status": 0,
  "data": { "formula": "41*8", "result": 328 },
  "msg": "success"
}
```

**Error response:**

```json
{ "code": -1, "msg": "识别失败" }
```

**Validation error (400):**

```json
{ "code": -1, "msg": "请求参数校验失败" }
```

**Auth error (401):**

```json
{ "status": -1, "msg": "认证失败" }
```

**curl examples:**

```bash
# Text captcha via URL
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' \
  -H 'Content-Type: application/json' \
  -d '{"type":"text","action":"onnx","bg":"https://images2018.cnblogs.com/blog/1047463/201804/1047463-20180406163706898-1017943434.png","range":"0123456789"}'

# Math captcha via Base64
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' \
  -H 'Content-Type: application/json' \
  -d '{"type":"math","action":"onnx","bg":"data:image/jpeg;base64,/9j/4AAQSkZJRg..."}'

# Text captcha via file upload
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' \
  -F 'type=text' \
  -F 'action=onnx' \
  -F 'bg=@captcha.png' \
  -F 'range=0123456789abcdef'
```

---

### `POST /captcha/rotate`

Determine the rotation angle to align a rotated CAPTCHA image.

**Authentication**: Required if AUTH_TYPE ≠ 0 (Bearer token).

**Content-Type**: `application/json` or `multipart/form-data`

**Request schema:**

| Field   | Type                                | Required | Description                                                              |
| ------- | ----------------------------------- | -------- | ------------------------------------------------------------------------ |
| `type`  | `"single"` \| `"nox"` \| `"tiktok"` | Yes      | Algorithm type                                                           |
| `bg`    | string \| File                      | Yes      | Image to rotate (single), or background/reference image (nox/tiktok)    |
| `thumb` | string \| File                      | No       | Foreground/rotated image for comparison. Required for `nox` and `tiktok`; ignored for `single`. |

**Algorithm descriptions:**

- **single**: Single-image rotation correction. Crops center to `size/sqrt(2)`, resizes to 224×224, classifies into 360 angle classes via ONNX model. Used for Baidu/Xiaohongshu style captchas.
- **nox**: Two-image template matching. Rotates foreground image and matches against background using `TM_CCORR_NORMED`. Two-stage search: coarse (5° step) + fine (1° step).
- **tiktok**: Two-circle color matching. Samples RGB pixels on circular rings; rotates foreground to minimize Euclidean distance to background samples. Two-stage search: coarse (2° step) + fine (1° step).

**Success response (200):**

```json
{
  "status": 0,
  "data": { "cw": 253, "ccw": 107 },
  "msg": "success"
}
```

- `cw`: clockwise rotation in degrees
- `ccw`: counter-clockwise rotation in degrees
- Note: `cw + ccw = 360`

**Error response:**

```json
{ "code": -1, "msg": "识别失败" }
```

**curl examples:**

```bash
# Single-image rotation (Baidu style)
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' \
  -H 'Content-Type: application/json' \
  -d '{"type":"single","bg":"https://github.com/chencchen/RotateCaptchaBreak/blob/master/data/baiduCaptcha/1615096444.jpg?raw=true"}'

# Two-image nox rotation
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' \
  -H 'Content-Type: application/json' \
  -d '{"type":"nox","thumb":"https://example.com/rotated.png","bg":"https://example.com/bg.png"}'

# Two-circle tiktok rotation
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' \
  -H 'Content-Type: application/json' \
  -d '{"type":"tiktok","thumb":"https://example.com/inner.png","bg":"https://example.com/outer.png"}'

# Single via file upload
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' \
  -F 'type=single' \
  -F 'bg=@rotated.png'
```

---

### `POST /captcha/slide`

Find the slider piece position in a background image.

**Authentication**: Required if AUTH_TYPE ≠ 0 (Bearer token).

**Content-Type**: `application/json` or `multipart/form-data`

**Request schema:**

| Field   | Type                     | Required | Description               |
| ------- | ------------------------ | -------- | ------------------------- |
| `type`  | `"match"` \| `"compare"` | Yes      | Detection algorithm       |
| `thumb` | string \| File           | Yes      | Slider piece image        |
| `bg`    | string \| File           | Yes      | Background image with gap |

**Algorithm descriptions:**

- **match**: Template matching via edge detection. Both images undergo: Gaussian blur → Canny edge detection → morphological dilation, then `TM_CCOEFF_NORMED` template matching to find the slider position.
- **compare**: Difference-based detection. Computes pixel differences between two images → binarization → morphological closing → contour finding → largest contour bounding box.

**Success response (200):**

```json
{
  "status": 0,
  "data": { "x": 214, "y": 0 },
  "msg": "success"
}
```

- `x`: horizontal offset in pixels
- `y`: vertical offset in pixels

**Error response:**

```json
{ "code": -1, "msg": "识别失败" }
```

**curl examples:**

```bash
# Template matching
curl -X POST 'http://127.0.0.1:7788/captcha/slide' \
  -H 'Content-Type: application/json' \
  -d '{"type":"match","thumb":"https://example.com/slider.png","bg":"https://example.com/bg.png"}'

# Difference comparison
curl -X POST 'http://127.0.0.1:7788/captcha/slide' \
  -H 'Content-Type: application/json' \
  -d '{"type":"compare","thumb":"https://example.com/slider.jpg","bg":"https://example.com/full.jpg"}'

# File upload
curl -X POST 'http://127.0.0.1:7788/captcha/slide' \
  -F 'type=match' \
  -F 'thumb=@slider.png' \
  -F 'bg=@background.png'
```

---

### `POST /captcha/detect`

Detect objects using YOLO-style object detection, or match thumb objects to a background image.

**Authentication**: Required if AUTH_TYPE ≠ 0 (Bearer token).

**Content-Type**: `application/json` or `multipart/form-data`

**Request schema:**

| Field   | Type                      | Required                                            | Description                            |
| ------- | ------------------------- | --------------------------------------------------- | -------------------------------------- |
| `type`  | `"detect"` \| `"match"`   | Yes                                                 | `detect`: single-image. `match`: two-image Hungarian matching. |
| `bg`    | string \| File            | Yes                                                 | Image to detect, or background for match |
| `thumb` | string \| File            | Required for `match`; not needed for `detect`       | Reference image for Hungarian matching |

**Success response (200):**

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

- `target`: Base64 cropped image of each detected/matched object.
- `coordinate`: Bounding box `{x1, y1, x2, y2}` in pixels.

**Error response:**

```json
{ "code": -1, "msg": "识别失败" }
```

**curl examples:**

```bash
# Single-image detect
curl -X POST 'http://127.0.0.1:7788/captcha/detect' \
  -H 'Content-Type: application/json' \
  -d '{"type":"detect","bg":"https://example.com/captcha.png"}'

# Two-image match (bg + thumb)
curl -X POST 'http://127.0.0.1:7788/captcha/detect' \
  -H 'Content-Type: application/json' \
  -d '{"type":"match","bg":"https://example.com/bg.png","thumb":"https://example.com/thumb.png"}'

# Match via file upload
curl -X POST 'http://127.0.0.1:7788/captcha/detect' \
  -F 'type=match' \
  -F 'bg=@bg.png' \
  -F 'thumb=@thumb.png'
```

---

### `POST /mcp`

MCP (Model Context Protocol) Streamable HTTP endpoint for AI agent integration. Single endpoint, no SSE, no sessions — direct request-response with JSON-RPC 2.0.

**Authentication**: Not required (MCP has its own protocol layer).

**How it works:** Send a JSON-RPC 2.0 request via `POST /mcp`, receive the response directly in the HTTP body.

**Available tools:**

| Tool     | Description              | Key arguments                      |
| -------- | ------------------------ | ---------------------------------- |
| `ocr`    | Text/math OCR            | `type`, `bg`, `action`(optional, default `onnx`), `range`(optional) |
| `rotate` | Rotation angle detection | `type`, `bg`, `thumb`(optional)    |
| `slide`  | Slider position matching | `type`, `thumb`, `bg`              |
| `detect` | Object detection         | `type`, `bg`, `thumb`(optional)    |

**Example flow:**

```bash
# 1. Initialize
curl -X POST 'http://127.0.0.1:7788/mcp' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-client","version":"1.0"}}}'

# 2. List tools
curl -X POST 'http://127.0.0.1:7788/mcp' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. Call OCR tool
curl -X POST 'http://127.0.0.1:7788/mcp' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ocr","arguments":{"type":"text","bg":"https://example.com/captcha.png","action":"onnx","range":"0123456789"}}}'
```

---

## Authentication Details

### AUTH_TYPE=0 (Disabled)

No authentication header needed.

### AUTH_TYPE=1 (Fixed Token)

Include the raw `AUTH_KEY` value as Bearer token:

```
Authorization: Bearer <AUTH_KEY>
```

Generate with: `bun run generate:token` (script outputs the key directly).

### AUTH_TYPE=2 (Timestamp Signature)

Token format: `timestamp:nonce:md5(timestamp:nonce:key)`

- `timestamp`: Unix timestamp in seconds
- `nonce`: 32-character random hex string
- `signature`: MD5 hash of the concatenation

The token is valid for 3 minutes from the timestamp.
Generate with: `bun run generate:token`

## Error Codes

| HTTP Status | `code` | Meaning                   |
| ----------- | ------ | ------------------------- |
| 200         | 0      | Success                   |
| 400         | -1     | Request validation failed |
| 401         | -1     | Authentication failed     |
| 500         | -1     | Internal server error     |

Note: Successful responses use `status: 0`, while error responses use `code: -1`.

## Image Format Support

All endpoints accept images in three formats:

1. **Base64 string** — With or without data URI prefix (`data:image/png;base64,...`). Plain base64 is auto-prefixed as PNG.
2. **URL** — Any HTTP/HTTPS URL. The service downloads the image with a 10-second timeout. Must have an image MIME type in the `Content-Type` response header.
3. **File upload** — Multipart form data with an image file. Must have an image MIME type (e.g., `image/png`, `image/jpeg`, `image/webp`).

Supported formats: PNG, JPEG, WebP, BMP, TIFF.

## Running the Service

### CLI Mode

> The code default is `cli`, but if `.env` sets `RUN_MODE=server`, that takes priority. Override it on the command line or remove from `.env`.

```bash
# Override .env
# macOS / Linux:
RUN_MODE=cli ./captcha-bypass ocr --type text --bg ./captcha.png
# Windows:
set RUN_MODE=cli && .\captcha-bypass.exe ocr --type text --bg ./captcha.png

# Or via bun
RUN_MODE=cli bun cli -- ocr --type text --bg ./captcha.png
```
> **Platform**: On **Windows**, replace `./captcha-bypass` with `.\captcha-bypass.exe`, and use `set VAR=val && ...` instead of `VAR=val ...`.

### Server Mode

Set `RUN_MODE=server` in `.env`, then:

```bash
# Development (with hot reload)
bun run dev

# Direct
bun src/index.ts

# Build standalone binary
bun run build
# Platform-specific: build:mac:arm64, build:linux:x64, etc.

# Run built binary
./dist/captcha-bypass-bin-macos-arm64
```
