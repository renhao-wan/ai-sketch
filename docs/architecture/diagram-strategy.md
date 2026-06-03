# 图表格式策略模式（Diagram Strategy）

本文档详细介绍项目核心架构模式 — 图表格式策略模式的设计与实现。

## 概述

图表格式策略模式用于隔离不同图表格式（Excalidraw、Mermaid、Draw.io）的处理逻辑。通过统一的 `DiagramStrategy` 接口，每种格式独立实现自己的提示词生成、后处理、优化、验证和导出逻辑。

```
┌─────────────────────────────────────────────────────────┐
│                   DiagramStrategy（接口）                 │
├─────────────────────────────────────────────────────────┤
│  format: DiagramFormat        // 格式标识                │
│  displayName: string          // 显示名称                │
│  codeLanguage: CodeLanguage   // 编辑器语言模式           │
│  fileExtension: string        // 文件扩展名              │
│  mimeType: string             // MIME 类型               │
├─────────────────────────────────────────────────────────┤
│  getSystemPrompt(): string                              │
│  getUserPrompt(userInput, chartType): string            │
│  postProcess(rawCode): string                           │
│  optimize(code): string                                 │
│  validate(code): ValidationResult                       │
│  createExportBlob(code): Blob                           │
│  generateImagePrompt(chartType): string                 │
└─────────────────────────────────────────────────────────┘
            │               │               │
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Excalidraw   │ │   Mermaid    │ │   Draw.io    │
    │  Strategy    │ │   Strategy   │ │   Strategy   │
    └──────────────┘ └──────────────┘ └──────────────┘
```

## 接口定义

**文件位置**：`lib/types/diagram-strategy.ts`

```typescript
export type DiagramFormat = 'excalidraw' | 'mermaid' | 'drawio';
export type CodeLanguage = 'json' | 'markdown' | 'xml';

export interface DiagramStrategy {
  // ── 元数据 ──
  readonly format: DiagramFormat;
  readonly displayName: string;
  readonly codeLanguage: CodeLanguage;
  readonly fileExtension: string;
  readonly mimeType: string;

  // ── 服务端（在 /api/generate 中调用）──
  getSystemPrompt(): string;
  getUserPrompt(userInput: string, chartType: string): string;

  // ── 客户端（在 editor/page.tsx 中调用）──
  postProcess(rawCode: string): string;
  optimize(code: string): string;
  validate(code: string): ValidationResult;
  createExportBlob(code: string): Blob;

  // ── 图片转图表 ──
  generateImagePrompt(chartType: string): string;
}

export type ValidationResult =
  | { valid: true; data: unknown }
  | { valid: false; error: string };
```

### 属性说明

| 属性 | 类型 | 说明 |
|------|------|------|
| `format` | `DiagramFormat` | 格式唯一标识，用于注册表查找 |
| `displayName` | `string` | 人类可读的显示名称 |
| `codeLanguage` | `CodeLanguage` | Monaco Editor 语法高亮模式 |
| `fileExtension` | `string` | 导出文件扩展名 |
| `mimeType` | `string` | 导出 Blob 的 MIME 类型 |

### 方法说明

| 方法 | 调用位置 | 说明 |
|------|----------|------|
| `getSystemPrompt()` | 服务端 | 返回 LLM 系统提示词 |
| `getUserPrompt()` | 服务端 | 返回 LLM 用户提示词 |
| `postProcess()` | 客户端 | 后处理 LLM 输出（去代码围栏、修复 JSON） |
| `optimize()` | 客户端 | 优化图表代码（如箭头对齐） |
| `validate()` | 客户端 | 验证代码是否可渲染 |
| `createExportBlob()` | 客户端 | 创建导出文件 Blob |
| `generateImagePrompt()` | 服务端 | 生成图片转图表的提示词 |

## 策略注册表

**文件位置**：`lib/strategies/registry.ts`

```typescript
import type { DiagramFormat, DiagramStrategy } from '@/lib/types/diagram-strategy';
import { excalidrawStrategy } from './excalidraw-strategy';
import { mermaidStrategy } from './mermaid-strategy';
import { drawioStrategy } from './drawio-strategy';

const strategies: Record<DiagramFormat, DiagramStrategy> = {
  excalidraw: excalidrawStrategy,
  mermaid: mermaidStrategy,
  drawio: drawioStrategy,
};

export function getStrategy(format: DiagramFormat): DiagramStrategy {
  const strategy = strategies[format];
  if (!strategy) throw new Error(`Unknown diagram format: ${format}`);
  return strategy;
}
```

**使用方式**：

```typescript
import { getStrategy } from '@/lib/strategies/registry';

const strategy = getStrategy('excalidraw');
const systemPrompt = strategy.getSystemPrompt();
```

## 实现详解

### Excalidraw Strategy

**文件位置**：`lib/strategies/excalidraw-strategy.ts`

**特点**：
- 输出格式：JSON 数组
- 后处理：去除代码围栏 + JSON 闭合修复 + 未转义引号修复
- 优化：箭头坐标对齐到绑定元素边缘中心

```typescript
class ExcalidrawStrategy implements DiagramStrategy {
  readonly format = 'excalidraw';
  readonly displayName = 'Excalidraw';
  readonly codeLanguage = 'json';
  readonly fileExtension = 'json';
  readonly mimeType = 'application/json';

  postProcess(rawCode: string): string {
    let processed = stripCodeFences(rawCode);
    processed = repairJsonClosure(processed);
    // 尝试解析，失败则修复未转义引号后重试
    try {
      JSON.parse(processed);
      return processed;
    } catch {
      processed = fixUnescapedQuotes(processed);
      processed = repairJsonClosure(processed);
      // ...
    }
  }

  optimize(code: string): string {
    return optimizeExcalidrawCode(code);  // 箭头对齐优化
  }
}
```

### Mermaid Strategy

**文件位置**：`lib/strategies/mermaid-strategy.ts`

**特点**：
- 输出格式：Mermaid Markdown 语法
- 后处理：去除代码围栏 + 语法清理
- 优化：无（Mermaid 渲染器自行处理布局）

### Draw.io Strategy

**文件位置**：`lib/strategies/drawio-strategy.ts`

**特点**：
- 输出格式：Draw.io XML
- 后处理：去除代码围栏 + XML 清理
- 优化：无

## 生命周期

### 1. 服务端阶段（/api/generate）

```
用户请求 → getStrategy(format)
    │
    ▼
strategy.getSystemPrompt()  → LLM 系统消息
strategy.getUserPrompt()    → LLM 用户消息
    │
    ▼
callLLM(config, messages)   → SSE 流式返回
```

### 2. 客户端阶段（editor/page.tsx）

```
LLM 流式输出（累积）
    │
    ▼
流结束
    │
    ▼
strategy.postProcess(rawCode)  → 去除代码围栏、修复格式
    │
    ▼
strategy.optimize(processedCode)  → 优化图表（如箭头对齐）
    │
    ▼
strategy.validate(optimizedCode)  → 验证是否可渲染
    │
    ▼
渲染到画布 + 保存到数据库
```

### 3. 导出阶段

```
用户点击导出
    │
    ▼
strategy.createExportBlob(code)  → 创建 Blob
    │
    ▼
下载文件（.json / .mmd / .drawio）
```

## 图表类型

每种格式支持多种图表类型，定义在 `lib/diagram/constants.ts`：

```typescript
export const CHART_TYPES = [
  { id: 'flowchart', name: '流程图' },
  { id: 'sequence', name: '时序图' },
  { id: 'class', name: '类图' },
  { id: 'er', name: 'ER 图' },
  { id: 'gantt', name: '甘特图' },
  { id: 'mindmap', name: '思维导图' },
  { id: 'architecture', name: '架构图' },
  // ...更多类型
];
```

策略根据图表类型生成不同的提示词：

```typescript
getUserPrompt(userInput: string, chartType: string): string {
  // 根据 chartType 调整提示词
  return buildExcalidrawUserPrompt(userInput, chartType);
}
```

## 数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                        /api/generate                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  configId ──► configManager.getConfig() ──► LLMConfig           │
│                                                    │            │
│  format ──► getStrategy(format) ──► DiagramStrategy │            │
│                                        │           │            │
│                                        ▼           ▼            │
│                              ┌─────────────────────────┐        │
│                              │    构建 LLM 消息         │        │
│                              │  system: getSystemPrompt │        │
│                              │  user: getUserPrompt     │        │
│                              └─────────────────────────┘        │
│                                        │                        │
│                                        ▼                        │
│                              ┌─────────────────────────┐        │
│                              │      callLLM()           │        │
│                              │   SSE 流式返回           │        │
│                              └─────────────────────────┘        │
│                                        │                        │
│                                        ▼                        │
│                              ┌─────────────────────────┐        │
│                              │   保存对话消息           │        │
│                              │   conversationManager   │        │
│                              └─────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 扩展新格式

添加新的图表格式只需 3 步：

### 1. 实现策略接口

```typescript
// lib/strategies/new-format-strategy.ts
import type { DiagramStrategy } from '@/lib/types/diagram-strategy';

class NewFormatStrategy implements DiagramStrategy {
  readonly format = 'newformat' as const;
  readonly displayName = 'New Format';
  readonly codeLanguage = 'json';  // 或其他语言
  readonly fileExtension = 'ext';
  readonly mimeType = 'application/json';

  getSystemPrompt(): string { /* ... */ }
  getUserPrompt(userInput: string, chartType: string): string { /* ... */ }
  postProcess(rawCode: string): string { /* ... */ }
  optimize(code: string): string { return code; }
  validate(code: string): ValidationResult { /* ... */ }
  createExportBlob(code: string): Blob { /* ... */ }
  generateImagePrompt(chartType: string): string { /* ... */ }
}

export const newFormatStrategy: DiagramStrategy = new NewFormatStrategy();
```

### 2. 注册到注册表

```typescript
// lib/strategies/registry.ts
import { newFormatStrategy } from './new-format-strategy';

const strategies: Record<DiagramFormat, DiagramStrategy> = {
  excalidraw: excalidrawStrategy,
  mermaid: mermaidStrategy,
  drawio: drawioStrategy,
  newformat: newFormatStrategy,  // 新增
};
```

### 3. 更新类型定义

```typescript
// lib/types/diagram-strategy.ts
export type DiagramFormat = 'excalidraw' | 'mermaid' | 'drawio' | 'newformat';
```

详细步骤参见：[开发扩展指南](../guides/extend-diagram.md)

## 最佳实践

1. **单一职责**：每个策略只处理一种格式
2. **无状态**：策略实例不应保存状态
3. **幂等性**：相同输入应产生相同输出
4. **错误处理**：postProcess 和 optimize 应优雅处理无效输入
5. **类型安全**：使用 TypeScript 严格模式，避免 `any`

## 相关文件

- `lib/types/diagram-strategy.ts` — 接口定义
- `lib/strategies/registry.ts` — 策略注册表
- `lib/strategies/excalidraw-strategy.ts` — Excalidraw 实现
- `lib/strategies/mermaid-strategy.ts` — Mermaid 实现
- `lib/strategies/drawio-strategy.ts` — Draw.io 实现
- `lib/strategies/helpers.ts` — 策略共享工具函数
- `lib/diagram/optimize-arrows.ts` — 箭头优化算法
- `lib/diagram/json-repair.ts` — JSON 修复工具
- `lib/diagram/constants.ts` — 图表类型常量
