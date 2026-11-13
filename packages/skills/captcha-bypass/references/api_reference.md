# 能力与数据格式说明

本文档描述 CLI 与 Server 两种模式**共用**的能力定义、参数语义与响应格式。

- CLI 调用方式分别见 `cli.md`
- Server 调用方式分别见 `server.md`

## 支持能力

| 能力          | CLI 命令         | Server 端点            | 鉴权 | 用途                   |
| ------------- | ---------------- | ---------------------- | ---- | ---------------------- |
| 文字/算术 OCR | `captcha ocr`    | `POST /captcha/ocr`    | 按需 | 识别文字或算术验证码   |
| 滑块定位      | `captcha slide`  | `POST /captcha/slide`  | 按需 | 定位滑块缺口位置       |
| 旋转对齐      | `captcha rotate` | `POST /captcha/rotate` | 按需 | 计算旋转对齐角度       |
| 目标检测      | `captcha detect` | `POST /captcha/detect` | 按需 | YOLO 检测 / 缩略图匹配 |
| 健康检查      | `health`         | `GET /health`          | 无需 | 服务健康状态           |

CLI 无需鉴权，Server 按需鉴权。

## 参数语义

CLI 用 `--<参数>` 形式，Server 用 JSON 字段形式，名称与取值一致。CLI 输出与 Server 响应结构一致：统一 JSON。

### 验证码

#### `ocr` — 文字/算术验证码识别

请求参数：

| 字段     | 必填 | 说明                                                                          |
| -------- | ---- | ----------------------------------------------------------------------------- |
| `type`   | 是   | `text`（文字）或 `math`（算术表达式）                                         |
| `bg`     | 是   | 待识别图片                                                                    |
| `action` | 否   | 识别引擎：`onnx`（本地模型，默认，快）/ `ai`（LLM 视觉，复杂文字更准）        |
| `range`  | 否   | 字符集过滤，仅识别指定字符。如 `0123456789`（数字）、`0123456789+-*/`（算术） |

响应示例：

```json
// type=text：`code` 为识别结果字符串
{
  "code": 0,
  "data": { "code": "AB3D" },
  "msg": "success"
}

// type=math：`formula` 为表达式，`result` 为计算结果
{
  "code": 0,
  "data": { "formula": "41*8", "result": 328 },
  "msg": "success"
}
```

#### `slide` — 滑块缺口定位

请求参数：

| 字段    | 必填 | 说明                                       |
| ------- | ---- | ------------------------------------------ |
| `type`  | 是   | `match`（模板匹配）/ `compare`（差异比对） |
| `bg`    | 是   | 带缺口的背景图                             |
| `thumb` | 是   | 滑块小图                                   |

响应示例：

```json
// `x`/`y` 为缺口水平/垂直偏移（像素）
{
  "code": 0,
  "data": { "x": 214, "y": 0 },
  "msg": "success"
}
```

#### `rotate` — 旋转角度计算

请求参数：

| 字段    | 必填            | 说明                                                                  |
| ------- | --------------- | --------------------------------------------------------------------- |
| `type`  | 是              | `single`（单图纠正）/ `nox`（双图模板匹配）/ `tiktok`（双圆色彩匹配） |
| `bg`    | 是              | 待旋转图（single），或背景参考图（nox/tiktok）                        |
| `thumb` | nox/tiktok 必填 | 前景旋转图（nox/tiktok），`single` 忽略                               |

响应示例：

```json
// `cw` 为顺时针矫正角度；`cww` 为逆时针矫正角度
// 取值均为 [0, 360)，已摆正时两者同为 0
{
  "code": 0,
  "data": { "cw": 253, "ccw": 107 },
  "msg": "success"
}
```

#### `detect` — 目标检测/匹配

请求参数：

| 字段    | 必填       | 说明                                                  |
| ------- | ---------- | ----------------------------------------------------- |
| `type`  | 是         | `detect`（单图 YOLO 检测）/ `match`（双图匈牙利匹配） |
| `bg`    | 是         | 待检测图（detect），或背景图（match）                 |
| `thumb` | match 必填 | 参考小图（match），`detect` 不需要                    |

响应示例：

```json
// `target` 为 Base64 裁剪图；`coordinate` 为包围盒 {x1,y1,x2,y2}
{
  "code": 0,
  "data": [
    {
      "target": "data:image/png;base64,...",
      "coordinate": { "x1": 10, "y1": 20, "x2": 50, "y2": 60 }
    }
  ],
  "msg": "success"
}
```

### 健康

#### `health` — 健康检查

请求参数：无。

响应示例：

```json
// `name` 服务名、`version` 版本、`timestamp` 毫秒时间戳
{
  "code": 0,
  "data": {
    "name": "captcha-bypass",
    "homepage": "...",
    "version": "1.1.2",
    "timestamp": 1781719500449
  },
  "msg": "success"
}
```

## 响应格式

所有接口的响应均包含公共字段 + 业务字段，平铺在顶层。以 OCR 文字识别为例：

正确

```json
{
  "code": 0,
  "data": { "code": "AB3D" },
  "msg": "success"
}
```

失败

```json
{
  "code": -1,
  "msg": "invalid image"
}
```

| 字段   | 说明                                         |
| ------ | -------------------------------------------- |
| `code` | 状态码，`0` 成功、`-1` 失败                  |
| `data` | 业务字段，成功时携带识别结果，失败时省略     |
| `msg`  | 提示信息，成功为 `"success"`，失败为具体原因 |

Server 模式额外通过 HTTP 状态码区分错误类型：`400`（参数校验失败）、`401`（鉴权失败）、`500`（内部错误），其余失败统一返回 HTTP `200`。

## 图片输入

两种模式支持以下图片输入方式：

1. **Base64 字符串**——可带或不带 data URI 前缀（`data:image/png;base64,...`）。
2. **HTTP(S) URL**——任意地址，服务端/客户端下载后处理。
3. **本地文件路径**（CLI 额外支持）——如 `/absolute/path/to/captcha.png`，**建议使用绝对路径**。
4. **文件上传**（Server 额外支持）——multipart/form-data 携带图片文件（`image/png`、`image/jpeg`、`image/webp` 等）。

支持的格式：PNG、JPEG、WebP。
