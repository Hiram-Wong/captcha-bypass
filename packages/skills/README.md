# Skills

本目录存放 `captcha-bypass` 的 skill 定义，供 AI Agent 在对话中调用验证码识别能力。

## 目录结构

```
skills/
└── captcha-bypass/          # 验证码识别 skill
    ├── SKILL.md             # skill 入口：能力路由、环境变量初始化、使用限制
    └── references/
        ├── cli.md           # CLI 模式调用指引
        ├── server.md        # Server 模式调用指引
        └── api_reference.md # CLI/Server 共用：能力定义、参数语义、响应格式、图片输入
```

## 说明

- `SKILL.md` 是 skill 的入口，描述能力、环境变量约定与使用限制。
- `references/` 下按调用模式与公共部分拆分文档，避免内容重复，具体能力清单与参数语义统一在 `api_reference.md` 维护。
- 首次调用前需完成环境变量初始化（`CAPTCHA_TYPE` / `CAPTCHA_BIN` / `CAPTCHA_KEY`），详见 `SKILL.md`。
