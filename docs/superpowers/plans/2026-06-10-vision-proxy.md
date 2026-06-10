# 图片处理管线改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有 LLM 模型都能处理图片输入，通过三层降级策略（Vision 模型 → Vision API → Tesseract.js OCR）实现。

**Architecture:** 服务端处理，所有图片处理逻辑集中在 `/api/generate` route 中。三层降级：Layer 1 检测当前模型是否支持 vision（模型名匹配），Layer 2 调用用户独立配置的 Vision API 提取描述，Layer 3 使用 Tesseract.js OCR 提取文字。前端几乎不变。

**Tech Stack:** TypeScript, tesseract.js, sql.js (WASM SQLite), Next.js API Route, Electron

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `lib/llm/vision-models.ts` | Vision 模型名匹配列表，`isVisionModel()` 函数 |
| `lib/llm/vision-proxy.ts` | 图片处理管线编排：三层降级逻辑 |
| `lib/db/vision-config.ts` | Vision API 配置的 DB 读写 |
| `components/settings/VisionSettings.tsx` | Vision API 配置 UI |
| `app/api/vision/test/route.ts` | Vision API 连通性测试接口 |

### Modified Files

| File | Change |
|------|--------|
| `lib/db/index.ts:117-118` | 新增 `vision_config` 建表语句 |
| `app/api/generate/route.ts:118-168` | 图片处理接入三层降级 |
| `lib/locales/zh.ts` | 新增 vision 相关翻译 |
| `lib/locales/en.ts` | 新增 vision 相关翻译 |
| `components/settings/SettingsSidebar.tsx:7,14-24` | 新增 vision Tab |
| `app/settings/page.tsx:13,25-37,69-79` | 注册 VisionSettings |
| `package.json` | 添加 tesseract.js 依赖 |
| `electron-builder.yml:30-33` | 添加 tesseract 语言包打包 |

### Unchanged Files

- `lib/input-strategies/*` — 图片输入策略不变
- `lib/llm/providers/*` — LLM Provider 不变
- `components/ai/AIPromptBox.tsx` — 首页输入框不变
- `components/ai/AICopilotPanel.tsx` — 编辑器侧栏不变
- `components/ai/MessageBubble.tsx` — 消息气泡不变
- `hooks/useFileUpload.ts` / `hooks/useGeneration.ts` — 不变

---

## Task 1: 安装 tesseract.js 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 tesseract.js**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm add tesseract.js
```

- [ ] **Step 2: 验证安装**

```bash
node -e "const Tesseract = require('tesseract.js'); console.log('tesseract.js loaded:', typeof Tesseract.recognize)"
```

Expected: `tesseract.js loaded: function`

- [ ] **Step 3: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): 添加 tesseract.js 依赖"
```

---

## Task 2: 下载 Tesseract 语言包

**Files:**
- Create: `assets/tesseract/eng.traineddata`
- Create: `assets/tesseract/chi_sim.traineddata`

- [ ] **Step 1: 创建目录并下载语言包**

```bash
mkdir -p d:/python/PycharmProjects/ai-sketch-project/ai-sketch/assets/tesseract
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch/assets/tesseract
curl -L -o eng.traineddata https://github.com/naptha/tessdata/blob/gh-pages/4.0.0/eng.traineddata?raw=true
curl -L -o chi_sim.traineddata https://github.com/naptha/tessdata/blob/gh-pages/4.0.0/chi_sim.traineddata?raw=true
```

- [ ] **Step 2: 验证文件存在**

```bash
ls -la d:/python/PycharmProjects/ai-sketch-project/ai-sketch/assets/tesseract/
```

Expected: 两个 `.traineddata` 文件，eng 约 4MB，chi_sim 约 2MB

- [ ] **Step 3: 提交**

```bash
git add assets/tesseract/
git commit -m "chore: 添加 Tesseract 中英文语言包"
```

---

## Task 3: 配置 electron-builder 打包语言包

**Files:**
- Modify: `electron-builder.yml:30-33`

- [ ] **Step 1: 修改 electron-builder.yml**

在 `extraResources` 中添加 tesseract 语言包：

```yaml
extraResources:
  - from: "data"
    to: "data"
    filter: ["**/*"]
  - from: "assets/tesseract"
    to: "tesseract"
    filter: ["**/*.traineddata"]
```

- [ ] **Step 2: 提交**

```bash
git add electron-builder.yml
git commit -m "chore: 配置 Tesseract 语言包打包"
```

---

## Task 4: 创建 vision 模型匹配列表

**Files:**
- Create: `lib/llm/vision-models.ts`

- [ ] **Step 1: 创建 vision-models.ts**

```typescript
/**
 * Vision 模型名匹配列表
 * 用于检测当前配置的 LLM 模型是否支持多模态（图片）输入
 */

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

/**
 * 判断模型是否支持 vision（多模态图片输入）
 * @param modelName 模型名称（大小写不敏感）
 */
export function isVisionModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return VISION_MODEL_PATTERNS.some(pattern => pattern.test(lower));
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/llm/vision-models.ts
git commit -m "feat(llm): 添加 vision 模型名匹配列表"
```

---

## Task 5: 创建 Vision API 配置 DB 层

**Files:**
- Modify: `lib/db/index.ts:117-118`（在 `idx_response_cache_config` 之后添加建表语句）
- Create: `lib/db/vision-config.ts`

- [ ] **Step 1: 在 db/index.ts 中添加 vision_config 建表语句**

在 `lib/db/index.ts` 第 117 行 `db.run('CREATE INDEX IF NOT EXISTS idx_response_cache_config ...')` 之后，添加：

```typescript
  // Vision API 配置表
  db.run(`
    CREATE TABLE IF NOT EXISTS vision_config (
      id TEXT PRIMARY KEY DEFAULT 'default',
      api_type TEXT NOT NULL DEFAULT 'openai',
      base_url TEXT NOT NULL DEFAULT '',
      api_key TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
```

- [ ] **Step 2: 创建 vision-config.ts**

```typescript
/**
 * Vision API 配置管理
 * 独立于主 LLM 配置，用于图片理解的多模态模型
 */

import { getDb, requestSave } from './index';

export interface VisionConfig {
  id: string;
  apiType: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_ID = 'default';

/**
 * 获取 Vision API 配置
 * 如果未配置，返回 null
 */
export async function getVisionConfig(): Promise<VisionConfig | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT id, api_type, base_url, api_key, model, created_at, updated_at FROM vision_config WHERE id = ?');
  stmt.bind([DEFAULT_ID]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: row.id as string,
      apiType: row.api_type as 'openai' | 'anthropic',
      baseUrl: row.base_url as string,
      apiKey: row.api_key as string,
      model: row.model as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  stmt.free();
  return null;
}

/**
 * 保存 Vision API 配置（upsert）
 */
export async function saveVisionConfig(config: Omit<VisionConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<VisionConfig> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);

  db.run(
    `INSERT INTO vision_config (id, api_type, base_url, api_key, model, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET api_type = ?, base_url = ?, api_key = ?, model = ?, updated_at = ?`,
    [DEFAULT_ID, config.apiType, config.baseUrl, config.apiKey, config.model, now, now,
     config.apiType, config.baseUrl, config.apiKey, config.model, now],
  );

  requestSave();

  return {
    id: DEFAULT_ID,
    apiType: config.apiType,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 删除 Vision API 配置
 */
export async function deleteVisionConfig(): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM vision_config WHERE id = ?', [DEFAULT_ID]);
  requestSave();
}

/**
 * 检查 Vision API 是否已配置（baseUrl、apiKey、model 都非空）
 */
export async function isVisionConfigured(): Promise<boolean> {
  const config = await getVisionConfig();
  return !!(config?.baseUrl && config?.apiKey && config?.model);
}
```

- [ ] **Step 3: 提交**

```bash
git add lib/db/index.ts lib/db/vision-config.ts
git commit -m "feat(db): 添加 Vision API 配置表和读写方法"
```

---

## Task 6: 创建 Vision Proxy 图片处理管线

**Files:**
- Create: `lib/llm/vision-proxy.ts`

- [ ] **Step 1: 创建 vision-proxy.ts**

```typescript
/**
 * 图片处理管线 — 三层降级策略
 *
 * Layer 1: 当前模型支持 vision → 直接返回图片
 * Layer 2: 用户配置了 Vision API → 调用 API 提取描述
 * Layer 3: Tesseract.js OCR → 提取文字
 */

import type { LLMConfig, ImageData } from '@/lib/types';
import { isVisionModel } from './vision-models';
import { getVisionConfig } from '@/lib/db/vision-config';
import { getProvider } from './providers';
import { proxyManager } from './proxy-manager';
import { fetch as undiciFetch } from 'undici';

// ── Types ──

export type ImageProcessResult =
  | { mode: 'vision'; images: ImageData[] }
  | { mode: 'text'; description: string };

// ── Layer 1: Vision Model Detection ──

function checkVisionSupport(config: LLMConfig): boolean {
  return isVisionModel(config.model);
}

// ── Layer 2: Vision API ──

/**
 * 调用 Vision API 提取图片描述
 * 使用用户独立配置的 Vision API（openai 兼容或 anthropic）
 */
async function extractViaVisionApi(
  images: ImageData[],
  userPrompt: string,
): Promise<string | null> {
  const visionConfig = await getVisionConfig();
  if (!visionConfig?.baseUrl || !visionConfig?.apiKey || !visionConfig?.model) {
    return null;
  }

  try {
    const provider = getProvider(visionConfig.apiType);
    const url = provider.getEndpoint(visionConfig.baseUrl);
    const headers = provider.buildRequestHeaders(visionConfig.apiKey);

    // 构建带图片的消息
    const message = {
      role: 'user' as const,
      content: userPrompt || '请详细描述这张图片的内容，包括其中的文字、图形、布局和结构关系。',
      images,
    };

    const processedMessage = provider.processMessage(message);
    const body = {
      model: visionConfig.model,
      messages: [processedMessage],
      stream: false,
      max_tokens: 4096,
    };

    const agent = await proxyManager.getAgent();
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };

    const response = agent
      ? await undiciFetch(url, { ...fetchOptions, dispatcher: agent } as any) as unknown as Response
      : await fetch(url, fetchOptions);

    if (!response.ok) {
      console.error('[Vision Proxy] Vision API 调用失败:', response.status, await response.text());
      return null;
    }

    const data = await response.json() as Record<string, unknown>;

    // 解析响应（OpenAI 和 Anthropic 格式）
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    if (choices?.[0]?.message) {
      return (choices[0].message as Record<string, unknown>).content as string;
    }

    // Anthropic 格式
    const content = data.content as Array<Record<string, unknown>> | undefined;
    if (content?.[0]?.text) {
      return content[0].text as string;
    }

    console.error('[Vision Proxy] 无法解析 Vision API 响应');
    return null;
  } catch (error) {
    console.error('[Vision Proxy] Vision API 调用异常:', error);
    return null;
  }
}

// ── Layer 3: Tesseract.js OCR ──

/**
 * 使用 Tesseract.js 提取图片中的文字
 * 语言包预打包在 assets/tesseract/ 目录
 */
async function extractViaOcr(images: ImageData[]): Promise<string> {
  const Tesseract = (await import('tesseract.js')).default;
  const path = await import('path');

  // 动态获取语言包路径
  let langPath: string;
  try {
    // Electron 生产环境
    const { app } = await import('electron');
    langPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tesseract')
      : path.join(process.cwd(), 'assets', 'tesseract');
  } catch {
    // 非 Electron 环境（开发/测试）
    langPath = path.join(process.cwd(), 'assets', 'tesseract');
  }

  const results = await Promise.all(images.map(async (img) => {
    try {
      const { data: { text } } = await Tesseract.recognize(
        Buffer.from(img.data, 'base64'),
        'eng+chi_sim',
        { langPath },
      );
      return text.trim();
    } catch (error) {
      console.error('[Vision Proxy] OCR 提取失败:', error);
      return '';
    }
  }));

  return results.filter(Boolean).join('\n\n');
}

// ── Pipeline Orchestrator ──

/**
 * 图片处理管线入口
 * 按三层降级策略处理图片，返回图片或文字描述
 *
 * @param config 当前 LLM 配置
 * @param images 用户上传的图片
 * @param userPrompt 用户输入的提示词
 */
export async function processImages(
  config: LLMConfig,
  images: ImageData[],
  userPrompt: string,
): Promise<ImageProcessResult> {
  // Layer 1: 当前模型直接支持 vision
  if (checkVisionSupport(config)) {
    console.log('[Vision Proxy] Layer 1: 当前模型支持 vision，直接发送图片');
    return { mode: 'vision', images };
  }

  console.log('[Vision Proxy] 当前模型不支持 vision，尝试降级处理');

  // Layer 2: 尝试 Vision API
  const visionDescription = await extractViaVisionApi(images, userPrompt);
  if (visionDescription) {
    console.log('[Vision Proxy] Layer 2: Vision API 提取成功');
    return { mode: 'text', description: visionDescription };
  }

  // Layer 3: Tesseract.js OCR
  console.log('[Vision Proxy] Layer 3: 使用 Tesseract.js OCR');
  const ocrText = await extractViaOcr(images);

  if (!ocrText) {
    throw new Error('图片文字提取失败，请确保图片清晰且包含文字内容');
  }

  return { mode: 'text', description: ocrText };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit --pretty
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add lib/llm/vision-proxy.ts
git commit -m "feat(llm): 实现图片处理管线 — 三层降级策略"
```

---

## Task 7: 集成到 API Route

**Files:**
- Modify: `app/api/generate/route.ts:118-168`

- [ ] **Step 1: 添加 import**

在 `app/api/generate/route.ts` 顶部添加：

```typescript
import { processImages } from '@/lib/llm/vision-proxy';
```

- [ ] **Step 2: 替换图片处理逻辑**

将第 118-168 行（从 `// Normalize image/images` 到 `const fullMessages` 之前）替换为：

```typescript
    // Normalize image/images into a single array
    const userContent = typeof userInput === 'string' ? userInput : (userInput.text || '');
    const allImages: ImageData[] = [];
    if (typeof userInput === 'object') {
      if (userInput.image) allImages.push(userInput.image);
      if (userInput.images) allImages.push(...userInput.images);
    }
    const sourceType = frontendSourceType || (allImages.length > 0 ? 'image' : 'text');

    if (regenerate) {
      // 重新生成：删除最后一条 assistant 消息，不添加新的 user 消息
      await conversationManager.deleteLastAssistantMessage(activeConversationId!);
    } else {
      // 正常生成：保存 user 消息
      const imageDataStr = allImages.length > 0
        ? (allImages.length === 1 ? allImages[0].data : JSON.stringify(allImages.map(img => ({ data: img.data, mimeType: img.mimeType }))))
        : undefined;
      const imageMimeTypeStr = allImages.length > 0
        ? (allImages.length === 1 ? allImages[0].mimeType : 'application/json')
        : undefined;
      await conversationManager.addMessage({
        conversationId: activeConversationId,
        role: 'user',
        content: userContent,
        imageData: imageDataStr,
        imageMimeType: imageMimeTypeStr,
        sourceType,
      });
    }

    // ── 图片处理管线：三层降级 ──
    let processedImages: ImageData[] | null = null;
    let imageDescription: string | null = null;

    if (allImages.length > 0) {
      perfMark('Image Processing');
      const imageResult = await processImages(config, allImages, userContent);
      if (imageResult.mode === 'vision') {
        processedImages = imageResult.images;
      } else {
        imageDescription = imageResult.description;
      }
      perfEnd('Image Processing');
    }

    // ── Build LLM messages with context ──
    perfMark('Build Context');
    const contextMessages = await conversationManager.buildContextMessages(activeConversationId);

    // Build the new user message for LLM
    let newUserMessage: LLMMessage;
    if (processedImages) {
      // Vision 模式：直接带图片
      newUserMessage = {
        role: 'user',
        content: strategy.getUserPrompt(userContent, chartType),
        images: processedImages,
      };
    } else if (imageDescription) {
      // 降级模式：图片描述 + 用户 prompt
      newUserMessage = {
        role: 'user',
        content: strategy.getUserPrompt(
          `[图片内容]\n${imageDescription}\n\n${userContent}`,
          chartType,
        ),
      };
    } else {
      newUserMessage = {
        role: 'user',
        content: strategy.getUserPrompt(
          typeof userInput === 'string' ? userInput : (userInput.text || ''),
          chartType,
        ),
      };
    }
```

- [ ] **Step 3: 修改缓存条件**

找到第 187 行的缓存条件：

```typescript
    const shouldCache = allImages.length === 0 && !regenerate;
```

替换为：

```typescript
    // Vision 模式不缓存（带图片），降级模式可缓存（纯文本）
    const shouldCache = !processedImages && !regenerate;
```

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit --pretty
```

Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add app/api/generate/route.ts
git commit -m "feat(api): 集成图片处理三层降级管线"
```

---

## Task 8: 添加国际化翻译

**Files:**
- Modify: `lib/locales/zh.ts`
- Modify: `lib/locales/en.ts`

- [ ] **Step 1: 在 zh.ts 中添加 vision 翻译**

在 `settings.cacheDesc` 行之后添加：

```typescript
  'settings.vision': '视觉模型',
  'settings.visionDesc': '配置用于图片理解的多模态模型，让所有模型都能处理图片',
```

在文件末尾（`}` 之前）添加：

```typescript
  // Vision
  'vision.apiType': 'API 类型',
  'vision.apiTypeOpenai': 'OpenAI 兼容',
  'vision.apiTypeAnthropic': 'Anthropic',
  'vision.baseUrl': 'Base URL',
  'vision.baseUrlPlaceholder': 'https://api.groq.com/openai/v1',
  'vision.apiKey': 'API Key',
  'vision.apiKeyPlaceholder': 'sk-...',
  'vision.model': '模型名称',
  'vision.modelPlaceholder': 'llama-4-scout',
  'vision.save': '保存配置',
  'vision.test': '测试连接',
  'vision.testSuccess': '连接成功',
  'vision.testFail': '连接失败',
  'vision.saved': '配置已保存',
  'vision.deleted': '配置已删除',
  'vision.noConfig': '未配置视觉模型时，图片将使用 OCR 提取文字',
  'vision.status': '状态',
  'vision.statusConfigured': '已配置',
  'vision.statusNotConfigured': '未配置',
  'vision.currentModel': '当前视觉模型',
```

- [ ] **Step 2: 在 en.ts 中添加 vision 翻译**

在对应位置添加英文翻译：

```typescript
  'settings.vision': 'Vision Model',
  'settings.visionDesc': 'Configure a multimodal model for image understanding, enabling all models to process images',

  // Vision
  'vision.apiType': 'API Type',
  'vision.apiTypeOpenai': 'OpenAI Compatible',
  'vision.apiTypeAnthropic': 'Anthropic',
  'vision.baseUrl': 'Base URL',
  'vision.baseUrlPlaceholder': 'https://api.groq.com/openai/v1',
  'vision.apiKey': 'API Key',
  'vision.apiKeyPlaceholder': 'sk-...',
  'vision.model': 'Model Name',
  'vision.modelPlaceholder': 'llama-4-scout',
  'vision.save': 'Save Config',
  'vision.test': 'Test Connection',
  'vision.testSuccess': 'Connection successful',
  'vision.testFail': 'Connection failed',
  'vision.saved': 'Config saved',
  'vision.deleted': 'Config deleted',
  'vision.noConfig': 'Without a vision model, images will be processed using OCR text extraction',
  'vision.status': 'Status',
  'vision.statusConfigured': 'Configured',
  'vision.statusNotConfigured': 'Not configured',
  'vision.currentModel': 'Current vision model',
```

- [ ] **Step 3: 提交**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(i18n): 添加视觉模型相关翻译"
```

---

## Task 9: 创建 Vision API 测试接口

**Files:**
- Create: `app/api/vision/test/route.ts`

- [ ] **Step 1: 创建测试接口**

```typescript
/**
 * POST /api/vision/test
 * 测试 Vision API 连通性
 * 发送一张 1x1 像素的测试图片验证 API 是否正常工作
 */

import { NextResponse } from 'next/server';
import { getVisionConfig } from '@/lib/db/vision-config';
import { getProvider } from '@/lib/llm/providers';
import { proxyManager } from '@/lib/llm/proxy-manager';
import { fetch as undiciFetch } from 'undici';

/** 1x1 红色像素 PNG 的 base64 */
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export async function POST() {
  try {
    const visionConfig = await getVisionConfig();
    if (!visionConfig?.baseUrl || !visionConfig?.apiKey || !visionConfig?.model) {
      return NextResponse.json(
        { success: false, message: 'Vision API 未配置' },
        { status: 400 },
      );
    }

    const provider = getProvider(visionConfig.apiType);
    const url = provider.getEndpoint(visionConfig.baseUrl);
    const headers = provider.buildRequestHeaders(visionConfig.apiKey);

    const message = {
      role: 'user' as const,
      content: 'Describe this image briefly.',
      images: [{ data: TEST_IMAGE_BASE64, mimeType: 'image/png' }],
    };

    const processedMessage = provider.processMessage(message);
    const body = {
      model: visionConfig.model,
      messages: [processedMessage],
      stream: false,
      max_tokens: 100,
    };

    const agent = await proxyManager.getAgent();
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };

    const response = agent
      ? await undiciFetch(url, { ...fetchOptions, dispatcher: agent } as any) as unknown as Response
      : await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        message: `API 返回 ${response.status}: ${errorText.substring(0, 200)}`,
      });
    }

    const data = await response.json() as Record<string, unknown>;

    // 检查响应格式
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const content = data.content as Array<Record<string, unknown>> | undefined;

    if (choices?.[0]?.message || content?.[0]?.text) {
      return NextResponse.json({
        success: true,
        message: `连接成功，模型 ${visionConfig.model} 可正常使用`,
      });
    }

    return NextResponse.json({
      success: false,
      message: 'API 响应格式异常',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `连接失败: ${(error as Error).message}`,
    });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/vision/test/route.ts
git commit -m "feat(api): 添加 Vision API 连通性测试接口"
```

---

## Task 10: 创建 Vision Settings UI

**Files:**
- Create: `components/settings/VisionSettings.tsx`

- [ ] **Step 1: 创建 VisionSettings.tsx**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '@/lib/locales';
import { Eye, Save, Trash2, TestTube2, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface VisionConfigState {
  apiType: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface VisionSettingsProps {
  isVisible?: boolean;
}

export default function VisionSettings({ isVisible }: VisionSettingsProps) {
  const { t } = useLocale();
  const [config, setConfig] = useState<VisionConfigState>({
    apiType: 'openai',
    baseUrl: '',
    apiKey: '',
    model: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentModel, setCurrentModel] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/vision/config');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({
            apiType: data.config.apiType,
            baseUrl: data.config.baseUrl,
            apiKey: data.config.apiKey,
            model: data.config.model,
          });
          setIsConfigured(true);
          setCurrentModel(data.config.model);
        } else {
          setIsConfigured(false);
          setCurrentModel('');
        }
      }
    } catch (error) {
      console.error('Failed to load vision config:', error);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadConfig();
      setTestResult(null);
    }
  }, [isVisible, loadConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/vision/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setIsConfigured(true);
        setCurrentModel(config.model);
        setTestResult(null);
      }
    } catch (error) {
      console.error('Failed to save vision config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch('/api/vision/config', { method: 'DELETE' });
      setConfig({ apiType: 'openai', baseUrl: '', apiKey: '', model: '' });
      setIsConfigured(false);
      setCurrentModel('');
      setTestResult(null);
    } catch (error) {
      console.error('Failed to delete vision config:', error);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/vision/test', { method: 'POST' });
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ success: false, message: (error as Error).message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 状态卡片 */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-indigo)]/10 flex items-center justify-center">
            <Eye size={20} className="text-[var(--accent-indigo)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">
              {t('vision.status')}: {isConfigured ? t('vision.statusConfigured') : t('vision.statusNotConfigured')}
            </p>
            {currentModel && (
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {t('vision.currentModel')}: {currentModel}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 配置表单 */}
      <div className="space-y-4">
        {/* API 类型 */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('vision.apiType')}
          </label>
          <select
            value={config.apiType}
            onChange={(e) => setConfig(prev => ({ ...prev, apiType: e.target.value as 'openai' | 'anthropic' }))}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          >
            <option value="openai">{t('vision.apiTypeOpenai')}</option>
            <option value="anthropic">{t('vision.apiTypeAnthropic')}</option>
          </select>
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('vision.baseUrl')}
          </label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
            placeholder={t('vision.baseUrlPlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('vision.apiKey')}
          </label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder={t('vision.apiKeyPlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          />
        </div>

        {/* 模型名 */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('vision.model')}
          </label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
            placeholder={t('vision.modelPlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !config.baseUrl || !config.apiKey || !config.model}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-indigo)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t('vision.save')}
        </button>

        <button
          onClick={handleTest}
          disabled={isTesting || !isConfigured}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--fg)] text-sm font-medium hover:bg-[var(--surface-warm-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isTesting ? <Loader2 size={16} className="animate-spin" /> : <TestTube2 size={16} />}
          {t('vision.test')}
        </button>

        {isConfigured && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
          >
            <Trash2 size={16} />
            {t('common.delete')}
          </button>
        )}
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          testResult.success
            ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
            : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
        }`}>
          {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {testResult.message}
        </div>
      )}

      {/* 提示信息 */}
      <p className="text-xs text-[var(--muted)]">
        {t('vision.noConfig')}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/settings/VisionSettings.tsx
git commit -m "feat(ui): 添加视觉模型配置界面"
```

---

## Task 11: 创建 Vision Config API 端点

**Files:**
- Create: `app/api/vision/config/route.ts`

- [ ] **Step 1: 创建 config API**

```typescript
/**
 * Vision Config CRUD API
 * GET  — 获取当前配置
 * PUT  — 保存配置
 * DELETE — 删除配置
 */

import { NextResponse } from 'next/server';
import { getVisionConfig, saveVisionConfig, deleteVisionConfig } from '@/lib/db/vision-config';

export async function GET() {
  try {
    const config = await getVisionConfig();
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { apiType, baseUrl, apiKey, model } = body;

    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: baseUrl, apiKey, model' },
        { status: 400 },
      );
    }

    const config = await saveVisionConfig({
      apiType: apiType || 'openai',
      baseUrl,
      apiKey,
      model,
    });

    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await deleteVisionConfig();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/vision/config/route.ts
git commit -m "feat(api): 添加 Vision Config CRUD 接口"
```

---

## Task 12: 注册 Settings Tab 和侧边栏

**Files:**
- Modify: `components/settings/SettingsSidebar.tsx:7,14-24`
- Modify: `app/settings/page.tsx:13,25-37,69-79`

- [ ] **Step 1: 修改 SettingsSidebar.tsx**

在 `SettingsTab` 类型中添加 `'vision'`：

```typescript
export type SettingsTab = 'appearance' | 'llm' | 'tags' | 'network' | 'conversations' | 'data' | 'cache' | 'vision' | 'shortcuts' | 'about';
```

在 import 中添加 `Eye` 图标：

```typescript
import { Palette, Wand2, Globe, MessageSquare, Database, Keyboard, Info, Tags, HardDrive, Eye, LucideIcon } from 'lucide-react';
```

在 tabs 数组中，在 `cache` 之后添加：

```typescript
  { key: 'vision', icon: Eye, labelKey: 'settings.vision' },
```

- [ ] **Step 2: 修改 settings/page.tsx**

添加 import：

```typescript
import VisionSettings from '@/components/settings/VisionSettings';
```

在 `VALID_TABS` 中添加 `'vision'`（在 `'cache'` 之后）：

```typescript
const VALID_TABS: SettingsTab[] = ['appearance', 'llm', 'tags', 'network', 'conversations', 'data', 'cache', 'vision', 'shortcuts', 'about'];
```

在 `tabDescriptions` 中添加：

```typescript
  vision: 'settings.visionDesc',
```

在 tabs 数组中，在 `cache` tab 之后添加：

```typescript
    { key: 'vision', component: <VisionSettings isVisible={activeTab === 'vision'} /> },
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit --pretty
```

Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add components/settings/SettingsSidebar.tsx app/settings/page.tsx
git commit -m "feat(ui): 注册视觉模型设置 Tab"
```

---

## Task 13: 端到端验证

- [ ] **Step 1: TypeScript 编译检查**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit --pretty
```

Expected: 无错误

- [ ] **Step 2: ESLint 检查**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm lint
```

Expected: 无新增错误

- [ ] **Step 3: 启动开发服务器验证**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm dev
```

验证项：
1. 设置页面 → 视觉模型 Tab 正常显示
2. 填写配置 → 保存成功
3. 测试连接 → 返回结果
4. 删除配置 → 清除成功

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: 完成图片处理管线改造 — 三层降级策略"
```
