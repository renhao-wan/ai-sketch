# Ollama 本地模型支持实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Sketch 添加 Ollama 本地模型运行时的原生支持，让用户可以完全离线使用 AI 图表生成功能。

**Architecture:** 新建独立的 `OllamaProvider` 实现 `LLMProvider` 接口，复用 OpenAI 的 SSE 解析逻辑，但使用 Ollama 特有的模型列表端点（`/api/tags`）。在设置页添加自动检测机制，发现本地 Ollama 服务后一键创建配置。

**Tech Stack:** Next.js App Router, React, TypeScript, SQLite (sql.js), Tailwind CSS v4

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `lib/types/index.ts` | 修改 | `LLMConfig.type` 新增 `'ollama'` |
| `lib/llm/providers/ollama.ts` | 新建 | Ollama Provider 实现 |
| `lib/llm/providers/registry.ts` | 修改 | 注册 OllamaProvider |
| `app/api/ollama/detect/route.ts` | 新建 | Ollama 检测 API |
| `lib/db/config-manager.ts` | 修改 | 验证逻辑调整 |
| `lib/locales/zh.ts` | 修改 | 新增 Ollama 相关翻译 |
| `lib/locales/en.ts` | 修改 | 新增 Ollama 相关翻译 |
| `components/settings/LLMSettings.tsx` | 修改 | 检测 Banner + 编辑器调整 |

---

### Task 1: 类型系统扩展

**Files:**
- Modify: `lib/types/index.ts:2`

- [ ] **Step 1: 修改 LLMConfig 类型**

将 `type` 字段的联合类型从 `'openai' | 'anthropic'` 扩展为 `'openai' | 'anthropic' | 'ollama'`。

```typescript
// lib/types/index.ts 第 3 行
type: 'openai' | 'anthropic' | 'ollama';
```

- [ ] **Step 2: TypeScript 编译检查**

```bash
cd ai-sketch && npx tsc --noEmit
```

Expected: 无类型错误（后续 Task 中引用 `'ollama'` 的代码尚未添加，不影响编译）

- [ ] **Step 3: Commit**

```bash
git add lib/types/index.ts
git commit -m "feat(ollama): 扩展 LLMConfig 类型支持 ollama"
```

---

### Task 2: Ollama Provider 实现

**Files:**
- Create: `lib/llm/providers/ollama.ts`
- Test: `lib/llm/providers/ollama.test.ts`

- [ ] **Step 1: 创建 OllamaProvider 测试文件**

```typescript
// lib/llm/providers/ollama.test.ts
import { describe, it, expect } from 'vitest';
import { OllamaProvider } from './ollama';

const provider = new OllamaProvider();

describe('OllamaProvider', () => {
  it('type 为 ollama', () => {
    expect(provider.type).toBe('ollama');
  });

  it('buildRequestHeaders 无 apiKey 时不发送 Authorization', () => {
    const headers = provider.buildRequestHeaders('');
    expect(headers).toEqual({ 'Content-Type': 'application/json' });
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('buildRequestHeaders 有 apiKey 时发送 Authorization', () => {
    const headers = provider.buildRequestHeaders('test-key');
    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key',
    });
  });

  it('getEndpoint 返回正确的 chat completions 路径', () => {
    expect(provider.getEndpoint('http://localhost:11434')).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('getModelsEndpoint 返回 /api/tags', () => {
    expect(provider.getModelsEndpoint('http://localhost:11434')).toBe('http://localhost:11434/api/tags');
  });

  it('buildModelsRequestHeaders 不需要 Authorization', () => {
    const headers = provider.buildModelsRequestHeaders('any-key');
    expect(headers).toEqual({});
  });

  it('buildRequestBody 包含正确的字段', () => {
    const body = provider.buildRequestBody(
      'llama3.1',
      [{ role: 'user', content: 'hello' }],
      0.5,
      4096,
    ) as Record<string, unknown>;
    expect(body.model).toBe('llama3.1');
    expect(body.stream).toBe(true);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(4096);
  });

  it('getSSEExtractors 能提取 content', () => {
    const extractors = provider.getSSEExtractors();
    const result = extractors.extractContent({
      choices: [{ delta: { content: 'hello' } }],
    });
    expect(result).toBe('hello');
  });

  it('getSSEExtractors 能检测 length 截断', () => {
    const extractors = provider.getSSEExtractors();
    const result = extractors.checkStop?.({
      choices: [{ finish_reason: 'length' }],
    });
    expect(result).toContain('TRUNCATED');
  });

  it('getSSEExtractors 跳过 [DONE]', () => {
    const extractors = provider.getSSEExtractors();
    expect(extractors.skipLine?.('data: [DONE]')).toBe(true);
    expect(extractors.skipLine?.('data: {"choices":[]}')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd ai-sketch && npx vitest run lib/llm/providers/ollama.test.ts
```

Expected: FAIL — `Cannot find module './ollama'`

- [ ] **Step 3: 实现 OllamaProvider**

```typescript
// lib/llm/providers/ollama.ts
/**
 * Ollama Provider 实现
 * 支持本地 Ollama 模型运行时
 * Ollama 提供 OpenAI 兼容的 /v1/chat/completions 端点，
 * 但模型列表使用独立的 /api/tags 端点，且不需要 API Key。
 */

import type { LLMMessage } from '@/lib/types';
import type { LLMProvider, SSEExtractors } from './types';

interface OllamaMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>;
}

export class OllamaProvider implements LLMProvider {
  readonly type = 'ollama';

  buildRequestHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Ollama 通常不需要 API Key，但如果有则发送
    if (apiKey && apiKey.trim() !== '') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
  }

  buildRequestBody(model: string, messages: LLMMessage[], temperature?: number, maxTokens?: number): object {
    return {
      model,
      messages: messages.map(m => this.processMessage(m)),
      stream: true,
      max_tokens: maxTokens ?? 16384,
      temperature: temperature ?? 0.5,
    };
  }

  getEndpoint(baseUrl: string): string {
    return `${baseUrl}/v1/chat/completions`;
  }

  getSSEExtractors(): SSEExtractors {
    return {
      extractContent: (json) => {
        const choices = json.choices as Array<Record<string, unknown>> | undefined;
        const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
        return delta?.content as string | undefined;
      },
      checkStop: (json) => {
        const choices = json.choices as Array<Record<string, unknown>> | undefined;
        const finishReason = choices?.[0]?.finish_reason;
        if (finishReason === 'length') {
          return 'TRUNCATED: Output was truncated due to max_tokens limit';
        }
        return undefined;
      },
      skipLine: (trimmed) => trimmed === 'data: [DONE]',
    };
  }

  processMessage(message: LLMMessage): OllamaMessage {
    const images = message.images;
    if (!images || images.length === 0) {
      return message;
    }

    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
      { type: 'text', text: message.content },
    ];

    for (const img of images) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType};base64,${img.data}`,
          detail: 'high',
        },
      });
    }

    return {
      role: message.role,
      content: contentParts,
    };
  }

  buildModelsRequestHeaders(_apiKey: string): Record<string, string> {
    return {};
  }

  getModelsEndpoint(baseUrl: string): string {
    return `${baseUrl}/api/tags`;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd ai-sketch && npx vitest run lib/llm/providers/ollama.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/llm/providers/ollama.ts lib/llm/providers/ollama.test.ts
git commit -m "feat(ollama): 实现 OllamaProvider"
```

---

### Task 3: Provider 注册

**Files:**
- Modify: `lib/llm/providers/registry.ts`

- [ ] **Step 1: 注册 OllamaProvider**

在 `registry.ts` 中导入并注册 `OllamaProvider`：

```typescript
// lib/llm/providers/registry.ts
import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';

const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  ollama: new OllamaProvider(),
};
```

`getProvider` 和 `getRegisteredTypes` 函数无需修改，它们已经基于 `providers` 对象动态工作。

- [ ] **Step 2: TypeScript 编译检查**

```bash
cd ai-sketch && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add lib/llm/providers/registry.ts
git commit -m "feat(ollama): 注册 OllamaProvider 到 registry"
```

---

### Task 4: 验证逻辑调整

**Files:**
- Modify: `lib/db/config-manager.ts:241-266`

- [ ] **Step 1: 修改 validateConfig 方法**

在 `validateConfig` 方法中，Ollama 类型跳过 API Key 验证。找到第 258 行的 API Key 验证逻辑：

```typescript
// 修改前
if (!config.apiKey || config.apiKey.trim() === '') {
  errors.push('API密钥不能为空');
}
```

改为：

```typescript
// 修改后 — Ollama 不需要 API Key
if (config.type !== 'ollama' && (!config.apiKey || config.apiKey.trim() === '')) {
  errors.push('API密钥不能为空');
}
```

- [ ] **Step 2: TypeScript 编译检查**

```bash
cd ai-sketch && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add lib/db/config-manager.ts
git commit -m "feat(ollama): Ollama 配置跳过 API Key 验证"
```

---

### Task 5: 国际化翻译

**Files:**
- Modify: `lib/locales/zh.ts`
- Modify: `lib/locales/en.ts`

- [ ] **Step 1: 添加中文翻译**

在 `lib/locales/zh.ts` 的 `config.` 相关键后面添加 Ollama 翻译：

```typescript
// 在 'config.modelPlaceholder' 行之后添加
'config.ollamaDetected': '检测到 Ollama 服务',
'config.ollamaDetectedDesc': '发现 {count} 个可用模型，点击快速添加配置',
'config.addOllamaConfig': '添加 Ollama 配置',
'config.ollamaNoApiKey': 'Ollama 通常不需要 API Key',
'config.ollamaDefaultUrl': 'http://localhost:11434',
```

- [ ] **Step 2: 添加英文翻译**

在 `lib/locales/en.ts` 的对应位置添加：

```typescript
'config.ollamaDetected': 'Ollama service detected',
'config.ollamaDetectedDesc': 'Found {count} available models, click to add config',
'config.addOllamaConfig': 'Add Ollama config',
'config.ollamaNoApiKey': 'Ollama usually doesn\'t need an API key',
'config.ollamaDefaultUrl': 'http://localhost:11434',
```

- [ ] **Step 3: TypeScript 编译检查**

```bash
cd ai-sketch && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(ollama): 添加 Ollama 相关国际化翻译"
```

---

### Task 6: Ollama 检测 API

**Files:**
- Create: `app/api/ollama/detect/route.ts`

- [ ] **Step 1: 创建检测 API 端点**

```typescript
// app/api/ollama/detect/route.ts
import { NextResponse } from 'next/server';

/** Ollama 默认地址 */
const OLLAMA_DEFAULT_URL = 'http://localhost:11434';

/** Ollama /api/tags 响应格式 */
interface OllamaTagResponse {
  models?: Array<{
    name: string;
    size?: number;
    digest?: string;
    details?: Record<string, unknown>;
  }>;
}

/**
 * POST /api/ollama/detect
 * 检测本地 Ollama 服务是否运行，并获取可用模型列表
 */
export async function POST() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 秒超时

    const response = await fetch(`${OLLAMA_DEFAULT_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        detected: false,
        error: `Ollama 服务响应异常: ${response.status}`,
      });
    }

    const data = (await response.json()) as OllamaTagResponse;
    const models = (data.models || []).map(m => ({
      id: m.name,
      name: m.name,
    }));

    return NextResponse.json({
      detected: true,
      models,
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'Ollama 服务连接超时'
      : '未检测到 Ollama 服务';
    return NextResponse.json({
      detected: false,
      error: message,
    });
  }
}
```

- [ ] **Step 2: TypeScript 编译检查**

```bash
cd ai-sketch && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add app/api/ollama/detect/route.ts
git commit -m "feat(ollama): 添加 Ollama 检测 API 端点"
```

---

### Task 7: 设置页 UI 集成

**Files:**
- Modify: `components/settings/LLMSettings.tsx`

- [ ] **Step 1: 添加 Ollama 检测状态和逻辑**

在 `LLMSettings` 组件中添加 Ollama 检测逻辑。在现有 `useEffect` 之后添加：

```typescript
// 在 LLMSettings 组件内部，loadConfigs 定义之后添加

/** Ollama 检测状态 */
const [ollamaDetected, setOllamaDetected] = useState(false);
const [ollamaModels, setOllamaModels] = useState<{ id: string; name: string }[]>([]);

/** 检测 Ollama 服务 */
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch('/api/ollama/detect', { method: 'POST' });
      const data = await res.json();
      if (!cancelled && data.detected && data.models?.length > 0) {
        setOllamaDetected(true);
        setOllamaModels(data.models);
      }
    } catch {
      // 静默忽略 — Ollama 未运行时不显示错误
    }
  })();
  return () => { cancelled = true; };
}, []);

/** 快速添加 Ollama 配置 */
const handleAddOllama = async () => {
  try {
    await api.createConfig({
      name: 'Ollama (本地)',
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
      model: ollamaModels[0]?.id || '',
      description: '本地 Ollama 模型',
    });
    setOllamaDetected(false); // 隐藏 Banner
    await loadConfigs();
    showNotification(t('config.createSuccess'), t('config.ollamaDetectedDesc', { count: ollamaModels.length }), 'success');
  } catch (err) {
    setError(t('config.saveFailed') + (err as Error).message);
  }
};
```

- [ ] **Step 2: 添加 Ollama 检测 Banner UI**

在 `CountBanner` 组件之后、操作栏之前添加：

```tsx
{/* Ollama 检测提示 */}
{ollamaDetected && (
  <div className="px-4 py-3 bg-[var(--accent-indigo)]/10 rounded-xl flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-[var(--accent-indigo)]">{t('config.ollamaDetected')}</p>
      <p className="text-xs text-[var(--muted)] mt-0.5">
        {t('config.ollamaDetectedDesc', { count: ollamaModels.length })}
      </p>
    </div>
    <button
      onClick={handleAddOllama}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] transition-all duration-200 font-medium"
    >
      <Plus size={14} />
      <span>{t('config.addOllamaConfig')}</span>
    </button>
  </div>
)}
```

- [ ] **Step 3: 修改 ConfigEditor 支持 Ollama**

在 `ConfigEditor` 组件中，修改 Provider 类型下拉选项，从：

```tsx
options={[{ value: 'openai', label: 'OpenAI' }, { value: 'anthropic', label: 'Anthropic' }]}
```

改为：

```tsx
options={[
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama' },
]}
```

- [ ] **Step 4: 修改 ConfigEditor 的 Provider 切换逻辑**

在 `onChange` 回调中，切换到 Ollama 时自动填充默认 URL：

```tsx
onChange={(v) => {
  const updates: Partial<LLMConfig> = { type: v as 'openai' | 'anthropic' | 'ollama', model: '' };
  // 切换到 Ollama 时自动填充默认 URL
  if (v === 'ollama' && !formData.baseUrl) {
    updates.baseUrl = 'http://localhost:11434';
  }
  setFormData({ ...formData, ...updates });
}}
```

- [ ] **Step 5: 修改 API Key 字段，Ollama 时显示提示**

在 API Key 输入框的 `placeholder` 处添加条件判断：

```tsx
placeholder={formData.type === 'ollama' ? t('config.ollamaNoApiKey') : 'sk-...'}
```

- [ ] **Step 6: 修改 API Key 必填标记**

API Key 的 label 中，`<span className="text-red-500">*</span>` 在 Ollama 时隐藏：

```tsx
<label htmlFor="configApiKey" className="block text-sm font-medium text-[var(--fg)] mb-1.5">
  {t('config.apiKey')}
  {formData.type !== 'ollama' && <span className="text-red-500"> *</span>}
</label>
```

- [ ] **Step 7: 修改 handleSave 跳过 Ollama 的 API Key 验证**

在 `ConfigEditor` 的 `handleSave` 方法中，调整验证逻辑：

```tsx
const handleSave = () => {
  if (!formData.name || !formData.type || !formData.baseUrl || !formData.model) {
    setError(t('config.fillAllRequired'));
    return;
  }
  // Ollama 不需要 API Key
  if (formData.type !== 'ollama' && !formData.apiKey) {
    setError(t('config.fillAllRequired'));
    return;
  }
  onSave(formData);
};
```

- [ ] **Step 8: 修改 Base URL placeholder**

```tsx
placeholder={
  formData.type === 'ollama'
    ? 'http://localhost:11434'
    : formData.type === 'openai'
      ? 'https://api.openai.com/v1'
      : 'https://api.anthropic.com/v1'
}
```

- [ ] **Step 9: TypeScript 编译检查**

```bash
cd ai-sketch && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 10: Commit**

```bash
git add components/settings/LLMSettings.tsx
git commit -m "feat(ollama): 设置页添加 Ollama 检测和配置 UI"
```

---

### Task 8: 集成验证

- [ ] **Step 1: 运行全量测试**

```bash
cd ai-sketch && npx vitest run
```

Expected: 所有测试通过

- [ ] **Step 2: TypeScript 编译检查**

```bash
cd ai-sketch && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: ESLint 检查**

```bash
cd ai-sketch && pnpm lint
```

Expected: 无 lint 错误

- [ ] **Step 4: 手动验证（如 Ollama 已安装）**

1. 确保 Ollama 正在运行：`ollama serve`
2. 启动开发服务器：`pnpm dev`
3. 进入设置页 → LLM 配置
4. 确认看到 "检测到 Ollama 服务" Banner
5. 点击 "添加 Ollama 配置"
6. 确认配置创建成功，模型列表正确
7. 设为活跃配置，进入编辑器测试生成

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat(ollama): 完成本地模型支持"
```
