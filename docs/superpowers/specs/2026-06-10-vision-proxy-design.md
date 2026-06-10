# 图片处理管线改造设计

**日期**: 2026-06-10
**状态**: 待审阅

## 背景

当前项目的图片处理流程是：用户上传图片 → base64 编码 → 直接发送给 LLM。只有支持 vision 的模型（GPT-4o、Claude Sonnet 4 等）能处理图片，纯文本模型（如 deepseek-chat）无法使用图片功能。

**目标**：让所有模型都能处理图片输入，通过三层降级策略实现。

## 设计决策

### 架构选择：服务端处理

所有图片处理逻辑集中在服务端（`/api/generate` route），前端几乎不变。

**理由**：
- 前端保持简单，不需要知道当前模型是否支持 vision
- Vision API Key 不暴露给客户端
- 和现有 `/api/generate` 流程完全兼容

### 设计风格：简单函数 + 策略思路

使用策略模式的思路（每个处理方式独立、可替换），但不使用完整的策略模式架构（无接口、注册表、工厂）。

**理由**：只有 3 个策略，降级顺序固定，逻辑简单，完整策略模式是过度设计。

## 三层降级策略

```
用户上传图片 → POST /api/generate { text, images }
    ↓
Layer 1: 当前模型支持 vision？（模型名匹配已知列表）
  → 是：直接带图片调 LLM（现有逻辑不变）
    ↓ 否
Layer 2: 用户配置了独立 Vision API？
  → 是：调 Vision API 获取图片描述 → 描述文本替换图片发 LLM
    ↓ 否
Layer 3: Tesseract.js OCR
  → 提取图片中的文字 → 文字替换图片发 LLM
```

### 降级错误处理

- Vision API 调用失败 → 自动降级到 OCR（不报错给用户）
- OCR 失败 → 返回错误提示用户

### 缓存行为

- **Vision 模式**（当前模型直接处理图片）：不缓存（和现有行为一致）
- **降级模式**（Vision API / OCR 转文字后）：可以缓存（最终发给 LLM 的是纯文本）

## 已知 Vision 模型列表

在 `lib/llm/vision-models.ts` 中维护正则匹配列表：

```typescript
const VISION_MODEL_PATTERNS = [
  /^gpt-4o/,           // GPT-4o 系列
  /^gpt-4-turbo/,      // GPT-4 Turbo
  /^claude-3/,         // Claude 3 系列
  /^claude-sonnet-4/,  // Claude Sonnet 4
  /^claude-opus-4/,    // Claude Opus 4
  /^gemini/,           // Gemini 系列
  /^qwen-vl/,          // Qwen-VL
  /^qwen2-vl/,         // Qwen2-VL
  /^internvl/,         // InternVL
  /^llava/,            // LLaVA
  /^moondream/,        // Moondream
  /^deepseek-vl/,      // DeepSeek-VL
];

export function isVisionModel(modelName: string): boolean {
  return VISION_MODEL_PATTERNS.some(pattern => pattern.test(modelName.toLowerCase()));
}
```

列表可扩展，用户不需要关心。

## Vision API 配置

### 数据模型

独立于主 LLM 配置，存储在 SQLite `vision_config` 表：

```sql
CREATE TABLE IF NOT EXISTS vision_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  api_type TEXT NOT NULL DEFAULT 'openai',   -- 'openai' | 'anthropic'
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

只存一条记录（id='default'），不需要多套配置。

### 配置 UI

在设置页面新增 **"视觉模型"** Tab（在"缓存"旁边）：

| 字段 | 类型 | 示例 |
|------|------|------|
| API 类型 | 下拉选择 | OpenAI 兼容 / Anthropic |
| Base URL | 输入框 | `https://api.groq.com/openai/v1` |
| API Key | 密码输入框 | `sk-...` |
| 模型名 | 输入框 | `llama-4-scout` |
| 测试按钮 | 按钮 | 发一张测试图片验证连通性 |

### 国际化

`zh.ts` / `en.ts` 新增：
- `vision.title` / `vision.desc`
- `vision.apiType` / `vision.baseUrl` / `vision.apiKey` / `vision.model`
- `vision.test` / `vision.testSuccess` / `vision.testFail`
- `vision.noConfig`

## Electron 特化

### 运行环境

永远是 Electron 模式，不需要考虑纯 Web 端部署。

### Tesseract.js 语言包

- 语言：`eng` + `chi_sim`（中英文）
- 存放位置：`assets/tesseract/` 目录
- 打包方式：通过 `electron-builder` 的 `extraResources` 打包到应用资源目录
- 加载方式：**预打包，不使用按需加载**，零网络依赖

```
ai-sketch/
├── assets/
│   └── tesseract/
│       ├── eng.traineddata
│       └── chi_sim.traineddata
```

### OCR 初始化

Tesseract.js 运行在 Next.js API Route（Node.js 环境）中，不使用 Electron API。语言包通过 `langPath` 指向项目内的 `assets/tesseract/` 目录。

```typescript
import Tesseract from 'tesseract.js';
import path from 'path';

// 语言包路径：相对于项目根目录
// 开发环境和打包后都使用 process.cwd() 或 __dirname 推算
const TESSERACT_LANG_DIR = path.join(process.cwd(), 'assets', 'tesseract');

async function ocrExtract(images: ImageData[]): Promise<string> {
  const results = await Promise.all(images.map(async (img) => {
    const { data: { text } } = await Tesseract.recognize(
      Buffer.from(img.data, 'base64'),
      'eng+chi_sim',
      { langPath: TESSERACT_LANG_DIR }
    );
    return text;
  }));
  return results.join('\n\n');
}
```

**注意**：由于永远是 Electron 模式，Next.js 服务端运行在 Electron 的主进程中，`process.cwd()` 指向应用目录，语言包路径可靠。打包时语言包通过 `extraResources` 复制到 `resources/` 目录，需要在路径逻辑中兼容：

```typescript
const TESSERACT_LANG_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'tesseract')  // 生产环境
  : path.join(process.cwd(), 'assets', 'tesseract'); // 开发环境
```

这里的 `app` 来自 `electron`，在 API Route 中通过动态导入获取。

### 构建配置

`electron-builder` 配置添加：
```json
{
  "extraResources": [
    { "from": "assets/tesseract", "to": "tesseract" }
  ]
}
```

## 文件变更清单

### 新增文件

| 文件 | 用途 |
|------|------|
| `lib/llm/vision-models.ts` | vision 模型名匹配列表 + `isVisionModel()` |
| `lib/llm/vision-proxy.ts` | 图片处理管线编排：Vision API 调用 + Tesseract.js OCR 降级 |
| `lib/db/vision-config.ts` | Vision API 配置的 DB 读写（`getVisionConfig` / `saveVisionConfig`） |
| `components/settings/VisionSettings.tsx` | Vision API 配置 UI |
| `app/api/vision/test/route.ts` | Vision API 连通性测试接口 |
| `assets/tesseract/eng.traineddata` | Tesseract 英文语言包 |
| `assets/tesseract/chi_sim.traineddata` | Tesseract 中文语言包 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `app/api/generate/route.ts` | 图片处理管线接入三层降级 |
| `lib/db/index.ts` | 新增 `vision_config` 表建表语句 |
| `lib/locales/zh.ts` | 新增 vision 相关翻译 |
| `lib/locales/en.ts` | 新增 vision 相关翻译 |
| `components/settings/SettingsSidebar.tsx` | 新增 "视觉模型" Tab |
| `app/settings/page.tsx` | 注册 VisionSettings 组件 |
| `package.json` | 添加 `tesseract.js` 依赖 |
| `electron-builder` 配置 | 添加 `extraResources` 语言包打包 |

### 不变的文件

- 前端 UI 组件（AIPromptBox、AICopilotPanel、MessageBubble）— 无改动
- `useFileUpload.ts` / `useGeneration.ts` — 无改动
- `image-strategy.ts` / `orchestrator.ts` — 无改动
- LLM Provider（openai.ts / anthropic.ts）— 无改动

## API Route 改造详情

`app/api/generate/route.ts` 中的关键改动：

```typescript
import { processImages } from '@/lib/llm/vision-proxy';

// 现有逻辑（不变）：
// const allImages = normalizeImages(userInput);

// 改造后：
if (allImages.length > 0) {
  const result = await processImages(config, allImages, userPrompt);

  if (result.mode === 'vision') {
    // Layer 1: 当前模型支持 vision，直接带图片
    newUserMessage.images = result.images;
    // 不走缓存（和现有行为一致）
    shouldCache = false;
  } else {
    // Layer 2/3: 降级为文字描述
    newUserMessage.content = `[图片内容]\n${result.description}\n\n${userPrompt}`;
    // 可以走缓存（纯文本）
  }
}
```

## 前端可选改动

`MessageBubble.tsx` 中，当消息是通过降级处理的，图片缩略图旁边可以加一个小图标提示处理方式（非必须，后续迭代）。
