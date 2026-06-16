## 📌 介绍

基于 `onnxruntime-wasm` 实现跨平台 ONNX 模型推理，支持 Bun 编译为独立二进制，无需 GPU 即可运行。

## 📖 使用

### 部署运行

#### 方式一：二进制 + 模型（推荐）

1. 从 [Releases](https://github.com/Hiram-Wong/captcha-bypass/releases) 下载对应平台的二进制和模型文件。
2. 将二进制和 `models/` 目录放在同一文件夹下：

```
captcha-bypass/
├── captcha-bypass-mac-arm64   # 二进制（按实际平台选择）
└── models/
    ├── detect.onnx
    ├── ocr.onnx
    ├── ocr.json
    └── rotate.onnx
```

3. 配置环境变量后启动：

```bash
# macOS / Linux
chmod +x captcha-bypass-mac-arm64
./captcha-bypass-mac-arm64

# Windows
./captcha-bypass-win-x64.exe
```

> 模型文件通过环境变量指定；不设置时默认加载二进制同级 `models/` 目录下的对应文件。

#### 方式二：Docker

```bash
docker pull ghcr.io/hiram-wong/captcha-bypass:latest
docker run -d -p 7788:7788 ghcr.io/hiram-wong/captcha-bypass:latest
```

> 模型已内置于镜像，无需额外挂载。通过 `-e` 传环境变量覆盖配置。

### 环境变量

| 配置               | 类型                              | 默认值      | 说明                                                            |
| :----------------- | :-------------------------------- | :---------- | :-------------------------------------------------------------- |
| PORT               | `number`                          | 7788        | 服务端口                                                        |
| OPENAPI_ENABLE     | `boolean`                         | false       | 是否启用 OpenAPI 文档                                           |
| NODE_ENV           | `"development"` \| `"production"` | development | 运行环境                                                        |
| AUTH_TYPE          | `0` \| `1` \| `2`                 | 0           | 0: 不启用；1: 固定值；2: 时间戳随机签名(3分钟)                  |
| AUTH_KEY           | `string`                          | 空字符串    | 认证密钥，AUTH_TYPE=1/2 时使用                                  |
| DETECT_MODEL_PATH  | `string`                          | 空字符串    | Detect 模型文件路径；为空时加载 `models/detect.onnx`            |
| OCR_MODEL_PATH     | `string`                          | 空字符串    | OCR 模型文件路径；为空时加载 `models/ocr.onnx`                  |
| OCR_CHARSET_PATH   | `string`                          | 空字符串    | OCR 字符集文件路径；为空时加载 `models/ocr.json`                |
| OCR_CHARSET_RANGES | `string`                          | 空字符串    | OCR 字符集范围过滤，如 `"0123456789"`；按字符拆分后过滤识别结果 |
| ROTATE_MODEL_PATH  | `string`                          | 空字符串    | ROTATE 模型文件路径；为空时加载 `models/rotate.onnx`            |

### 请求地址

[http://127.0.0.1:7788](http://127.0.0.1:7788)

### 接口简述

| 说明       | 接口              | 方法 | 参数                                                                             |
| :--------- | :---------------- | :--- | :------------------------------------------------------------------------------- |
| 目标检测   | `/captcha/detect` | POST | type(必传): detect / match<br>bg(必传)<br>thumb(match 必传)                      |
| 文本验证码 | `/captcha/ocr`    | POST | type(必传): text / math<br>bg(必传)<br>range(可选): 识别字符集范围 |
| 旋转验证码 | `/captcha/rotate` | POST | type(必传): single/ nox / tiktok<br>bg(必传)<br>thumb(nox/tiktok 必传)           |
| 滑动验证码 | `/captcha/slide`  | POST | type(必传): match / comparison<br>thumb(必传)<br>bg(必传)                        |
| 健康检查   | `/health`         | GET  |                                                                                  |
| MCP 协议   | `/mcp`            | POST | Streamable HTTP 传输，body：JSON-RPC 2.0 消息（详见工具列表）                   |

### 调用说明

- JSON: Content-Type: application/json (传 Base64 或 URL)
- Form: Content-Type: multipart/form-data (传 图片文件)

<details>
<summary>展开查看MCP调用</summary>

MCP 端点遵循 [Model Context Protocol](https://modelcontextprotocol.io) 协议，使用 Streamable HTTP 传输 JSON-RPC 2.0 消息。所有请求发送到 `POST /mcp`，直接返回 JSON-RPC 响应。

#### 1. 初始化

```bash
curl -X POST 'http://127.0.0.1:7788/mcp' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "client", "version": "1.0" }
    }
  }'
```

#### 2. 获取工具列表

```bash
curl -X POST 'http://127.0.0.1:7788/mcp' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

#### 3. 调用 OCR 识别

```bash
curl -X POST 'http://127.0.0.1:7788/mcp' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "ocr",
      "arguments": { "type": "text", "image": "https://images2018.cnblogs.com/blog/1047463/201804/1047463-20180406163706898-1017943434.png", "range":"0123456789" }
    }
  }'
```

</details>

<details>
<summary>展开查看常见问题</summary>

#### 识别不准确？

- 使用onnx部分由模型决定的，请自行使用 [dddd_trainer](https://github.com/sml2h3/dddd_trainer) 工具训练特定场景专属数据模型。
- 使用opencv部分为非通用场景, 特定场景需请自行完成算法完成匹配。

#### 算术题识别不准确？

- 算术计算也与模型挂钩。
- 只支持四则运算(加减乘除), 不支持其他运算(取余开方取余)等计算。
- `+`和`*`错误率较高, 建议根据给出的公式手动替换符号再次计算。

</details>

<details>
<summary>展开查看请求示例</summary>

#### 目标

```bash
curl -X POST 'http://127.0.0.1:7788/captcha/detect' -H 'Content-Type: multipart/form-data' \
-F 'type=detect' \
-F 'bg=https://camo.githubusercontent.com/.../img/result2.jpg'
# {"status":0,"data":[{"target":"data:image/png;base64,...","coordinate":{"x1":246,"y1":47,"x2":287,"y2":87}}, ...],"msg":"success"}

curl -X POST 'http://127.0.0.1:7788/captcha/detect' -H 'Content-Type: multipart/form-data' \
-F 'type=match' \
-F 'bg=https://camo.githubusercontent.com/.../bg.jpg' \
-F 'thumb=https://camo.githubusercontent.com/.../thumb.jpg'
# {"status":0,"data":[{"target":"data:image/png;base64,...","coordinate":{"x1":14,"y1":101,"x2":99,"y2":217}}, ...],"msg":"success"}
```

#### 文本

```bash
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' -H 'Content-Type: application/json' -d '{
  "type": "text",
  "bg": "https://images2018.cnblogs.com/blog/1047463/201804/1047463-20180406163706898-1017943434.png",
  "range": "0123456789"
}' # {"status":0,"data":{"code":"0413"},"msg":"success"}
```

```bash
curl -X POST 'http://127.0.0.1:7788/captcha/ocr' -H 'Content-Type: application/json' -d '{
  "type": "math",
  "bg": "data:image/jpeg;base64,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"
}' # {"status":0,"data":{"formula":"41*8","result":328},"msg":"success"}
```

#### 旋转

```bash
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' -H 'Content-Type: application/json' -d '{
  "type": "single",
  "bg": "https://github.com/chencchen/RotateCaptchaBreak/blob/master/data/baiduCaptcha/1615096444.jpg?raw=true"
}' # {"status":0,"data":{"cw":253,"ccw":107},"msg":"success"}
```

```bash
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' -H 'Content-Type: application/json' -d '{
  "type": "nox",
  "thumb": "https://aisearch.cdn.bcebos.com/fileManager/Kd4NhrVAnd-Xb07XyhFDNyL8o8W6ok-5XB3BKJCkBzA/17812845752526QDSku.png",
  "bg": "https://aisearch.cdn.bcebos.com/fileManager/Kd4NhrVAnd-Xb07XyhFDNyL8o8W6ok-5XB3BKJCkBzA/1781284569883njSOO4.png"
}' # {"status":0,"data":{"cw":85,"ccw":275},"msg":"success"}
```

```bash
curl -X POST 'http://127.0.0.1:7788/captcha/rotate' -H 'Content-Type: application/json' -d '{
  "type": "tiktok",
  "thumb": "https://github.com/ycq0125/rotate_captcha/blob/main/imgs/inner_5.png?raw=true",
  "bg": "https://github.com/ycq0125/rotate_captcha/blob/main/imgs/outer_5.png?raw=true"
}' # {"status":0,"data":{"cw":325,"ccw":35},"msg":"success"}
```

#### 滑块

```bash
curl -X POST 'http://127.0.0.1:7788/captcha/slide' -H 'Content-Type: application/json' -d '{
  "type": "match",
  "thumb": "https://camo.githubusercontent.com/0db95c4247a43b41d5f3e3c9068856df40eaf6339fcfb86988a122b49939a4af/68747470733a2f2f63646e2e77656e616e7a68652e636f6d2f696d672f612e706e67",
  "bg": "https://camo.githubusercontent.com/9fb4d767ad341b1d594c30dbe284aaddc131204ae0cc9f3b82968a88ccd67b79/68747470733a2f2f63646e2e77656e616e7a68652e636f6d2f696d672f622e706e67"
}' # {"status":0,"data":{"x":214,"y":0},"msg":"success"}%
```

```bash
curl -X POST 'http://127.0.0.1:7788/captcha/slide' -H 'Content-Type: application/json' -d '{
  "type": "compare",
  "thumb": "https://camo.githubusercontent.com/53c5f15724fe306bca6b903cb5f2b74990cb6a620690f4b19ad26ff464706dbc/68747470733a2f2f63646e2e77656e616e7a68652e636f6d2f696d672f62672e6a7067",
  "bg": "https://camo.githubusercontent.com/ac0c1a2501a0aaa3d58e561aefea4a410f59849fa16afd652d7d06c7e0ad4e81/68747470733a2f2f63646e2e77656e616e7a68652e636f6d2f696d672f66756c6c706167652e6a7067"
}' # {"status":0,"data":{"x":142,"y":66},"msg":"success"}
```

</details>

## 🛠️ 开发

> 安装[bun](https://bun.com/docs/installation)

```bash
cp .env.example .env # 复制环境变量配置文件
bun install # 安装依赖
bun run dev # 开发模式
bun run build:{platform}:{arch} # 构建二进制, 如: bun run build:darwin:arm64
```

## 📝 许可

> 本项目沿用原项目 [ddddocr](https://github.com/sml2h3/ddddocr) 的许可证 [MIT License](./LICENSE)

使用本项目即表示您已阅读并同意以下条款(谁使用, 谁负责)：

1. 合法使用: 不得将本项目用于任何违法、违规或侵犯他人权益的行为，包括但不限于网络攻击、诈骗、绕过身份验证、未经授权的数据抓取等。
2. 风险自负: 任何因使用本项目而产生的法律责任、技术风险或经济损失，由使用者自行承担，项目作者不承担任何形式的责任。
3. 禁止滥用: 不得将本项目用于违法牟利、黑产活动或其他不当商业用途。

## 📄 鸣谢

- [onnxruntime-web](https://github.com/microsoft/onnxruntime-web) - 模型推理
- [ddddocr](https://github.com/sml2h3/ddddocr) - 文字识别/对象识别/滑块算法
- [ddddocr(pr 259)](https://github.com/k23223/ddddocr) - 单图矫正算法
- [JJBJJ](https://github.com/JJBJJ) - 双图Nox算法
- [来一碗清茶(csdn)](https://blog.csdn.net/u011931957/article/details/147661195) - 双图Tiktok算法
