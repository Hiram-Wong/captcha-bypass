# Server 模式使用文档

HTTP RESTful API 端点，支持鉴权，调用远程服务，适合长期集成使用。

> 模式选择与环境变量约定见 `SKILL.md` 的「环境变量初始化」：`CAPTCHA_TYPE=server`，`CAPTCHA_BIN` 为服务地址；`CAPTCHA_KEY` 为鉴权 key。

## 调用方式

```bash
curl "$CAPTCHA_BIN/<端点>"
```

- `<字段>`：JSON 字段形式，语义见 `api_reference.md`
- `<端点>`：有两种：
  - `/captcha/<命令>`：验证码识别，能力见 `api_reference.md`
  - `/health`：健康检查

```bash
# 健康检查
curl "$CAPTCHA_BIN/health"
```

## 鉴权

该调用模式采用按需鉴权。是否鉴权由环境变量 `$CAPTCHA_KEY` 判断：有值则需鉴权，为空字符串则无需鉴权。端点需要鉴权的前提是：开启了鉴权，且该端点需要鉴权。

有鉴权时：

- 端点鉴权：见 `api_reference.md` 的「支持能力」表
- Header：`Authorization: Bearer $CAPTCHA_KEY`
- API Key 格式：`sk-xxxxxxxx`
- 禁止内联 Key：curl 命令中必须使用 `$CAPTCHA_KEY`，禁止直接写出真实 Key 值
- 状态码：返回 `401` 表示 key 缺失或失效，需重新获取 `$CAPTCHA_KEY`

```bash
# 有鉴权时且需要鉴权的端点
curl -H "Authorization: Bearer $CAPTCHA_KEY" "$CAPTCHA_BIN/captcha/ocr" ...
```

## 调用示例

```bash
# OCR 文字验证码（URL 输入 + 数字过滤）
curl -X POST "$CAPTCHA_BIN/captcha/ocr" \
  -H 'Content-Type: application/json' \
  -d '{"type":"text","action":"onnx","bg":"https://example.com/captcha.png","range":"0123456789"}'

# OCR 算术验证码（Base64 输入）
curl -X POST "$CAPTCHA_BIN/captcha/ocr" \
  -H 'Content-Type: application/json' \
  -d '{"type":"math","action":"onnx","bg":"data:image/jpeg;base64,/9j/4AAQSkZJRg..."}'

# 滑块缺口定位（文件上传）
curl -X POST "$CAPTCHA_BIN/captcha/slide" \
  -F 'type=match' -F 'thumb=@slider.png' -F 'bg=@bg.png'

# 旋转角度（单图）
curl -X POST "$CAPTCHA_BIN/captcha/rotate" \
  -H 'Content-Type: application/json' \
  -d '{"type":"single","bg":"https://example.com/rotated.png"}'

# 目标检测（单图）
curl -X POST "$CAPTCHA_BIN/captcha/detect" \
  -H 'Content-Type: application/json' \
  -d '{"type":"detect","bg":"https://example.com/captcha.png"}'
```

> 图片输入方式（URL / Base64 / 文件上传）、响应格式见 `api_reference.md`。
