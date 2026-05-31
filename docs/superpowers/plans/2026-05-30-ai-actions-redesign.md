# AI 操作按钮与底部面板重新设计 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将浮动 AI 按钮和底部面板从占位功能改为真正 AI 驱动的操作，支持布局、美化、简化、解释四个功能。

**Architecture:** 新建 `/api/ai-action` 轻量端点复用 `llm-client.ts`，前端修改 FloatingAIActions 和 BottomContextPanel 组件，通过 SSE 流式传输结果。

**Tech Stack:** Next.js App Router, TypeScript, SSE streaming, llm-client.ts

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `types/index.ts` | 修改 | 更新 `AIActionId` 类型定义 |
| `app/api/ai-action/route.ts` | 新建 | AI 操作 API 端点 |
| `lib/ai-action/prompts.ts` | 新建 | 各操作的 system prompt |
| `components/ai/FloatingAIActions.tsx` | 修改 | 更新按钮列表，添加 loading 状态 |
| `components/layout/BottomContextPanel.tsx` | 修改 | 移除无用标签，添加解释标签 |
| `locales/zh.ts` | 修改 | 添加新翻译键 |
| `locales/en.ts` | 修改 | 添加新翻译键 |
| `app/editor/page.tsx` | 修改 | 实现 handleAIAction 逻辑 |

---

### Task 1: 更新类型定义和翻译

**Files:**
- Modify: `types/index.ts:58`
- Modify: `locales/zh.ts`
- Modify: `locales/en.ts`

- [ ] **Step 1: 更新 AIActionId 类型**

```typescript
// types/index.ts:58
export type AIActionId = 'layout' | 'beautify' | 'simplify' | 'explain';
```

- [ ] **Step 2: 添加中文翻译**

```typescript
// locales/zh.ts - 替换现有的 aiAction 部分
'aiAction.layout': 'AI 布局',
'aiAction.beautify': 'AI 美化',
'aiAction.simplify': 'AI 简化',
'aiAction.explain': 'AI 解释',
'aiAction.noCode': '请先生成图表',
'aiAction.loading': 'AI 处理中...',
```

- [ ] **Step 3: 添加英文翻译**

```typescript
// locales/en.ts - 替换现有的 aiAction 部分
'aiAction.layout': 'AI Layout',
'aiAction.beautify': 'AI Beautify',
'aiAction.simplify': 'AI Simplify',
'aiAction.explain': 'AI Explain',
'aiAction.noCode': 'Please generate a diagram first',
'aiAction.loading': 'AI processing...',
```

- [ ] **Step 4: Commit**

```bash
git add types/index.ts locales/zh.ts locales/en.ts
git commit -m "feat: 更新 AI 操作类型定义和翻译"
```

---

### Task 2: 创建 AI 操作 API 端点

**Files:**
- Create: `lib/ai-action/prompts.ts`
- Create: `app/api/ai-action/route.ts`

- [ ] **Step 1: 创建 prompts 文件**

```typescript
// lib/ai-action/prompts.ts
import type { DiagramFormat } from '@/types/diagram-strategy';

export type AIActionType = 'layout' | 'beautify' | 'simplify' | 'explain';

const ACTION_PROMPTS: Record<AIActionType, string> = {
  layout: '你是图表布局专家。分析用户提供的图表代码，自动调整节点位置和间距，使图表更整齐易读。只返回修改后的完整代码，不要任何解释。',
  beautify: '你是图表美化专家。优化图表的视觉风格，包括颜色搭配、字体大小、对齐方式。只返回修改后的完整代码，不要任何解释。',
  simplify: '你是代码简化专家。精简图表代码结构，去除冗余元素，合并重复定义。只返回修改后的完整代码，不要任何解释。',
  explain: '你是图表分析专家。解释用户提供的图表的含义、逻辑流程、关键节点和潜在问题。使用简洁的中文回答。',
};

export function getActionSystemPrompt(action: AIActionType): string {
  return ACTION_PROMPTS[action];
}

export function getActionUserPrompt(action: AIActionType, code: string, format: DiagramFormat): string {
  if (action === 'explain') {
    return `请解释以下 ${format} 格式的图表：\n\n${code}`;
  }
  return `请对以下 ${format} 格式的图表代码进行${action === 'layout' ? '布局优化' : action === 'beautify' ? '美化处理' : '简化处理'}：\n\n${code}`;
}
```

- [ ] **Step 2: 创建 API 端点**

```typescript
// app/api/ai-action/route.ts
import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { getActionSystemPrompt, getActionUserPrompt, type AIActionType } from '@/lib/ai-action/prompts';
import type { DiagramFormat } from '@/types/diagram-strategy';

interface AIActionRequest {
  code: string;
  format: DiagramFormat;
  action: AIActionType;
  configId?: string;
}

export async function POST(request: Request) {
  try {
    const body: AIActionRequest = await request.json();
    const { code, format, action, configId } = body;

    if (!code || !format || !action) {
      return NextResponse.json({ error: 'Missing required fields: code, format, action' }, { status: 400 });
    }

    // Get LLM config
    let config;
    if (configId) {
      config = await configManager.getConfig(configId);
    } else {
      config = await configManager.getActiveConfig();
    }

    if (!config) {
      return NextResponse.json({ error: 'No LLM config found' }, { status: 400 });
    }

    // Build messages
    const messages = [
      { role: 'system' as const, content: getActionSystemPrompt(action) },
      { role: 'user' as const, content: getActionUserPrompt(action, code, format) },
    ];

    // SSE stream
    const encoder = new TextEncoder();
    const timeoutMs = 5 * 60 * 1000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedController = new AbortController();
    request.signal?.addEventListener('abort', () => combinedController.abort());
    timeoutController.signal.addEventListener('abort', () => combinedController.abort());

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await callLLM(config, messages, (chunk) => {
            const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }, combinedController.signal);

          // For non-explain actions, post-process the result
          if (action !== 'explain') {
            const { getStrategy } = await import('@/lib/strategies/registry');
            const strat = getStrategy(format);
            const processed = strat.postProcess(result);
            const optimized = strat.optimize(processed);
            // Send final processed result
            const finalData = `data: ${JSON.stringify({ type: 'result', content: optimized })}\n\n`;
            controller.enqueue(encoder.encode(finalData));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          const errorMessage = isAbort ? 'Request timeout' : (error as Error).message;
          const errorData = `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          clearTimeout(timeoutId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI action error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai-action/prompts.ts app/api/ai-action/route.ts
git commit -m "feat: 添加 AI 操作 API 端点"
```

---

### Task 3: 更新 FloatingAIActions 组件

**Files:**
- Modify: `components/ai/FloatingAIActions.tsx`

- [ ] **Step 1: 重写 FloatingAIActions 组件**

```typescript
// components/ai/FloatingAIActions.tsx
'use client';

import {
  LayoutGrid,
  Palette,
  Minimize2,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { useLocale } from '@/locales';
import type { AIActionId } from '@/types';
import type { TranslationKey } from '@/locales';

interface FloatingAIActionsProps {
  onAction?: (actionId: AIActionId) => void;
  loadingAction?: AIActionId | null;
  disabled?: boolean;
}

const ACTIONS: { id: AIActionId; icon: typeof LayoutGrid; labelKey: TranslationKey; color: string }[] = [
  { id: 'layout', icon: LayoutGrid, labelKey: 'aiAction.layout', color: 'from-[var(--accent-indigo)] to-[var(--accent-violet)]' },
  { id: 'beautify', icon: Palette, labelKey: 'aiAction.beautify', color: 'from-[var(--accent-violet)] to-purple-500' },
  { id: 'simplify', icon: Minimize2, labelKey: 'aiAction.simplify', color: 'from-[var(--accent-cyan)] to-teal-500' },
  { id: 'explain', icon: HelpCircle, labelKey: 'aiAction.explain', color: 'from-amber-500 to-orange-500' },
];

export default function FloatingAIActions({ onAction, loadingAction, disabled }: FloatingAIActionsProps) {
  const { t } = useLocale();

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="flex flex-col gap-2">
        {ACTIONS.map((action) => {
          const isLoading = loadingAction === action.id;
          const Icon = isLoading ? Loader2 : action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onAction?.(action.id)}
              disabled={disabled || !!loadingAction}
              title={t(action.labelKey)}
              className={`group relative w-10 h-10 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-[var(--bg-glass)] border border-[var(--border)] shadow-[0_4px_20px_rgba(28,25,23,0.05)] transition-all duration-300 ${
                isLoading
                  ? 'animate-pulse cursor-wait'
                  : disabled || loadingAction
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-[0_0_30px_rgba(124,58,237,0.12)] hover:bg-[var(--card)] hover:-translate-y-px hover-lift'
              }`}
            >
              <Icon size={17} className={`text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors duration-200 ${isLoading ? 'animate-spin' : ''}`} />
              {/* Tooltip */}
              <div className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-[0_4px_16px_rgba(28,25,23,0.12)]">
                {isLoading ? t('aiAction.loading') : t(action.labelKey)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/FloatingAIActions.tsx
git commit -m "feat: 更新浮动 AI 操作按钮组件"
```

---

### Task 4: 更新 BottomContextPanel 组件

**Files:**
- Modify: `components/layout/BottomContextPanel.tsx`

- [ ] **Step 1: 重写 BottomContextPanel 组件**

```typescript
// components/layout/BottomContextPanel.tsx
'use client';

import { useState, type ReactNode, type MouseEvent } from 'react';
import { ChevronDown, ChevronUp, Code2, Sparkles } from 'lucide-react';
import { useLocale } from '@/locales';
import type { TranslationKey } from '@/locales';

const TABS: { id: string; labelKey: TranslationKey; icon: typeof Code2 }[] = [
  { id: 'code', labelKey: 'panel.generatedCode', icon: Code2 },
  { id: 'explain', labelKey: 'aiAction.explain', icon: Sparkles },
];

interface BottomContextPanelProps {
  generatedCode?: string;
  children?: ReactNode;
  explanation?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function BottomContextPanel({
  generatedCode,
  children,
  explanation,
  activeTab: controlledTab,
  onTabChange,
}: BottomContextPanelProps) {
  const { t } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [internalTab, setInternalTab] = useState('code');
  const [height, setHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);

  const activeTab = controlledTab ?? internalTab;

  const handleTabChange = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (e: globalThis.MouseEvent) => {
      const delta = startY - e.clientY;
      setHeight(Math.min(Math.max(startHeight + delta, 100), 400));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (isCollapsed) {
    return (
      <div className="flex-shrink-0 border-t border-black/[0.06] bg-[var(--bg-glass)] backdrop-blur-xl">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-all duration-200 hover:bg-[var(--surface-warm-hover)]"
        >
          <ChevronUp size={14} />
          <span>{t('panel.expandPanel')}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 border-t border-black/[0.06] bg-[var(--bg-glass)] backdrop-blur-xl flex flex-col"
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-1.5 cursor-row-resize hover:bg-gradient-to-r hover:from-[var(--accent-indigo)]/20 hover:via-[var(--accent-violet)]/20 hover:to-[var(--accent-cyan)]/20 transition-all duration-300 flex-shrink-0 group"
      >
        <div className="w-8 h-0.5 bg-black/10 rounded-full mx-auto mt-0.5 group-hover:bg-[var(--accent-indigo)]/40 transition-colors duration-200" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 flex-shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[var(--accent-indigo)]/8 text-[var(--accent-indigo)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
            >
              <tab.icon size={13} />
              <span>{t(tab.labelKey)}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-3 scrollbar-thin">
        {activeTab === 'code' && children ? (
          children
        ) : activeTab === 'code' && generatedCode ? (
          <pre className="text-xs font-mono text-[var(--fg)]/80 whitespace-pre-wrap break-words">
            {generatedCode}
          </pre>
        ) : activeTab === 'explain' && explanation ? (
          <div className="text-sm text-[var(--fg)]/80 whitespace-pre-wrap break-words leading-relaxed">
            {explanation}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--muted)]/50">
            {activeTab === 'code' && t('panel.codeWillAppear')}
            {activeTab === 'explain' && t('aiAction.noCode')}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/BottomContextPanel.tsx
git commit -m "feat: 更新底部面板组件，移除无用标签，添加解释标签"
```

---

### Task 5: 实现编辑器页面的 AI 操作逻辑

**Files:**
- Modify: `app/editor/page.tsx`

- [ ] **Step 1: 添加新的状态和导入**

在 `page.tsx` 的状态声明区域添加：

```typescript
const [aiActionLoading, setAiActionLoading] = useState<AIActionId | null>(null);
const [aiExplanation, setAiExplanation] = useState('');
const [bottomPanelTab, setBottomPanelTab] = useState('code');
```

- [ ] **Step 2: 实现 handleAIAction 函数**

替换现有的 `handleAIAction` 函数：

```typescript
const handleAIAction = async (actionId: AIActionId) => {
  if (!generatedCode) {
    setNotification({ isOpen: true, title: t('aiAction.noCode'), message: '', type: 'warning' });
    return;
  }

  setAiActionLoading(actionId);

  try {
    const response = await fetch('/api/ai-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: generatedCode,
        format,
        action: actionId,
        configId: config?.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI action failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    let accumulated = '';
    let finalResult = '';
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content') {
            accumulated += parsed.content;
          } else if (parsed.type === 'result') {
            finalResult = parsed.content;
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    if (actionId === 'explain') {
      setAiExplanation(accumulated);
      setBottomPanelTab('explain');
    } else {
      const codeToApply = finalResult || accumulated;
      setGeneratedCode(codeToApply);
      tryParseAndApply(codeToApply);
    }
  } catch (error) {
    console.error('AI action error:', error);
    setNotification({
      isOpen: true,
      title: t('aiAction.loading'),
      message: (error as Error).message,
      type: 'error',
    });
  } finally {
    setAiActionLoading(null);
  }
};
```

- [ ] **Step 3: 更新 FloatingAIActions 调用**

找到 `<FloatingAIActions onAction={handleAIAction} />`，替换为：

```typescript
<FloatingAIActions
  onAction={handleAIAction}
  loadingAction={aiActionLoading}
  disabled={isGenerating || !generatedCode}
/>
```

- [ ] **Step 4: 更新 BottomContextPanel 调用**

找到 `<BottomContextPanel generatedCode={generatedCode}>`，替换为：

```typescript
<BottomContextPanel
  generatedCode={generatedCode}
  explanation={aiExplanation}
  activeTab={bottomPanelTab}
  onTabChange={setBottomPanelTab}
>
```

- [ ] **Step 5: Commit**

```bash
git add app/editor/page.tsx
git commit -m "feat: 实现编辑器页面的 AI 操作逻辑"
```

---

### Task 6: 清理旧代码和测试

**Files:**
- Modify: `app/editor/page.tsx`

- [ ] **Step 1: 移除 handleOptimizeCode 函数**

删除 `handleOptimizeCode` 函数（约第 307-315 行）。

- [ ] **Step 2: 移除 CodeEditor 的 onOptimize prop**

找到 `<CodeEditor ... onOptimize={handleOptimizeCode} ...>`，移除 `onOptimize` prop。

- [ ] **Step 3: 测试完整流程**

1. 启动开发服务器：`pnpm dev`
2. 打开编辑器页面
3. 生成一个图表
4. 点击每个 AI 按钮，验证：
   - 布局/美化/简化：画布和代码编辑器同步更新
   - 解释：底部面板自动切换到解释标签，显示解释文本
5. 验证无代码时点击按钮显示提示
6. 验证 loading 状态正确显示

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 清理旧代码，完成 AI 操作功能"
```
