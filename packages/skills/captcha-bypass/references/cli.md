# CLI 模式使用文档

命令行直接调用，输出 JSON 到 stdout，适合脚本和一次性识别，无需常驻服务。

> 模式选择与环境变量约定见 `SKILL.md` 的「环境变量初始化」：`CAPTCHA_TYPE=cli`，`CAPTCHA_BIN` 为二进制路径。

## 调用方式

```bash
"$CAPTCHA_BIN" cli <类型> <命令> <参数>
```

- `<参数>`：`--<字段>` 形式，语义见 `api_reference.md`
- `<类型>`：有两种：
  - `captcha`：验证码识别，含 `<命令>`，能力见 `api_reference.md`
  - `health`：健康检查，无 `<命令>`

```bash
# 健康检查
./captcha-bypass cli health

# Windows：将 ./captcha-bypass 替换为 .\captcha-bypass.exe
```

## 鉴权

该调用模式无鉴权机制。

## 调用示例

```bash
# OCR 文字验证码（本地文件 + 数字过滤）
"$CAPTCHA_BIN" cli captcha ocr --type text --bg /absolute/path/to/captcha.png --range 0123456789

# OCR 算术验证码（LLM 视觉引擎）
"$CAPTCHA_BIN" cli captcha ocr --type math --bg /absolute/path/to/captcha.png --action ai

# 滑块缺口定位（模板匹配）
"$CAPTCHA_BIN" cli captcha slide --type match --bg /absolute/path/to/bg.png --thumb /absolute/path/to/slider.png

# 旋转角度（双图模板匹配）
"$CAPTCHA_BIN" cli captcha rotate --type nox --bg /absolute/path/to/bg.png --thumb /absolute/path/to/rotated.png

# 目标检测（单图）
"$CAPTCHA_BIN" cli captcha detect --type detect --bg /absolute/path/to/captcha.png

# 健康检查
"$CAPTCHA_BIN" cli health
```

> 图片输入方式（本地路径 / URL / Base64）、响应格式见 `api_reference.md`。CLI 本地文件路径建议使用绝对路径。
