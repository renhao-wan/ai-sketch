# 图片处理管线 — 三层降级策略

本文档介绍图片输入的处理机制，包括三层降级策略、Vision 模型检测和配置管理。

## 概述

当用户上传图片时，系统会根据当前 LLM 模型的能力自动选择最优处理方案：

```
用户上传图片
    │
    ▼
┌──────────────────────────────────────────────┐
│ Layer 1: 当前模型支持 vision？                │
│   → 是：直接将 base64 图片发送给 LLM         │
│   → 否：进入 Layer 2                          │
└──────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│ Layer 2: 用户配置了 Vision API？              │
│   → 是：调用 Vision API 提取图片描述          │
│   → 否：进入 Layer 3                          │
└──────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│ Layer 3: Tesseract.js OCR                     │
│   → 提取图片中的文字内容                      │
│   → 提取失败则抛出错误                        │
└──────────────────────────────────────────────┘
```

## 层级详解

### Layer 1: Vision 模型直传

**条件**：当前 LLM 模型名称匹配已知的 vision 模型列表

**行为**：
- 将 base64 图片数据直接附加到 LLM 请求中
- 图片数据存入数据库 `messages.image_data` 字段
- `sourceType` 标记为 `'image'`

**支持的模型**（`lib/llm/vision-models.ts`）：

| 模型系列 | 匹配规则 |
|---------|---------|
| GPT-4o | `/^gpt-4o/` |
| GPT-4 Turbo | `/^gpt-4-turbo/` |
| Claude 3 | `/^claude-3/` |
| Claude Sonnet 4 | `/^claude-sonnet-4/` |
| Claude Opus 4 | `/^claude-opus-4/` |
| Gemini | `/^gemini/` |
| Qwen-VL | `/^qwen-vl/`, `/^qwen2-vl/` |
| InternVL | `/^internvl/` |
| LLaVA | `/^llava/` |
| Moondream | `/^moondream/` |
| DeepSeek-VL | `/^deepseek-vl/` |

匹配规则：模型名称转小写后与正则列表逐一匹配。

### Layer 2: Vision API 提取描述

**条件**：当前模型不支持 vision，但用户在设置中配置了独立的 Vision API

**行为**：
- 调用用户配置的 Vision API（支持 OpenAI 兼容和 Anthropic 格式）
- 将图片发送给 Vision API，获取文字描述
- 描述文字存入 `messages.content`，**不存 base64 数据**
- `sourceType` 标记为 `'text'`
- 存储格式：`[图片内容]\n{描述文字}\n\n{用户输入}`

**Vision API 配置**（`lib/db/vision-config.ts`）：
- 独立于主 LLM 配置
- 支持 `openai` 和 `anthropic` 两种 API 类型
- 配置项：`apiType`、`baseUrl`、`apiKey`、`model`
- 存储在数据库 `vision_config` 表中

**默认 prompt**：如果用户未输入提示词，使用默认描述：
> "请详细描述这张图片的内容，包括其中的文字、图形、布局和结构关系。"

### Layer 3: Tesseract.js OCR

**条件**：Layer 1 和 Layer 2 均不可用

**行为**：
- 使用 Tesseract.js 进行 OCR 文字识别
- 支持中英文（`eng+chi_sim` 语言包）
- 提取的文字存入 `messages.content`，**不存 base64 数据**
- `sourceType` 标记为 `'text'`

**语言包路径**：
- Electron 生产环境：`process.resourcesPath/tesseract/`
- 开发环境：`process.cwd()/assets/tesseract/`

**限制**：只能提取图片中的文字，无法理解图形、布局等视觉信息。

## 返回类型

```typescript
type ImageProcessResult =
  | { mode: 'vision'; images: ImageData[] }    // Layer 1：返回图片数据
  | { mode: 'text'; description: string };     // Layer 2/3：返回文字描述
```

## 对上下文的影响

### Layer 1（Vision 模式）

- 图片 base64 数据存入数据库
- 历史消息中图片会被重复发送给 LLM（每次请求都带）
- 适用于上下文窗口较大的 vision 模型

### Layer 2/3（降级模式）

- 图片描述以纯文本存入 `content` 字段
- `image_data` 为空，历史消息不携带 base64 数据
- 后续轮次的上下文中不包含图片数据，节省 token

## 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│ 生成路由（app/api/generate/route.ts）                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. 接收用户上传的图片（base64）                                  │
│ 2. 调用 processImages(config, images, userPrompt)               │
│ 3. 根据返回结果决定存储方式：                                     │
│    - vision 模式 → 存 base64 到 image_data                      │
│    - text 模式   → 存描述文字到 content，image_data 为空         │
│ 4. 构建 LLM 消息：                                              │
│    - vision 模式 → 消息附带 images 字段                          │
│    - text 模式   → 纯文本消息                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 关键文件

| 文件 | 职责 |
|------|------|
| `lib/llm/vision-proxy.ts` | 三层降级管线主逻辑 |
| `lib/llm/vision-models.ts` | Vision 模型名匹配列表 |
| `lib/db/vision-config.ts` | Vision API 配置的 CRUD |
| `app/api/generate/route.ts` | 调用管线并根据结果存储消息 |

## 相关文档

- [输入类型策略模式](./input-strategy.md) — 文件和图片的输入策略接口
- [响应缓存](./response-cache.md) — 缓存机制（Vision 模式不缓存，降级模式可缓存）
- [优化路线图](../future/optimization-roadmap.md) — 待优化问题列表
