# 输入类型策略模式（Input Strategy）

本文档详细介绍输入类型策略模式的设计与实现，用于处理不同类型的用户输入（文本、文件、图片）。

## 概述

输入类型策略模式将不同类型的用户输入处理逻辑隔离到独立的策略中，通过 `InputOrchestrator` 编排器协调多个策略的验证、处理和合并。

```
┌─────────────────────────────────────────────────────────┐
│                   InputStrategy（接口）                   │
├─────────────────────────────────────────────────────────┤
│  sourceType: InputSourceType    // 输入源类型            │
│  canHandle(file): boolean       // 是否能处理该文件      │
│  validate(input): ValidationResult                      │
│  process(input): Promise<unknown>                       │
│  buildMessage(data, prompt, chartType): MessagePayload  │
└─────────────────────────────────────────────────────────┘
            │                       │
            ▼                       ▼
    ┌──────────────┐       ┌──────────────┐
    │  FileStrategy │       │ ImageStrategy│
    │  （文本文件）  │       │  （图片文件） │
    └──────────────┘       └──────────────┘
            │                       │
            └───────────┬───────────┘
                        ▼
              ┌──────────────────┐
              │ InputOrchestrator│
              │   （编排器）      │
              └──────────────────┘
```

## 接口定义

**文件位置**：`lib/types/input-strategy.ts`

```typescript
export type InputSourceType = 'text' | 'file' | 'image';

export type InputValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export interface ProcessedItem {
  sourceType: InputSourceType;
  data: unknown;
  fileName: string;
}

export type MessagePayload =
  | { type: 'text'; content: string; sourceType: InputSourceType }
  | { type: 'image'; content: { text: string; images: unknown[] }; sourceType: 'image' };

export interface InputStrategy {
  readonly sourceType: InputSourceType;
  canHandle(file: File): boolean;
  validate(input: unknown): InputValidationResult;
  process(input: unknown): Promise<unknown>;
  buildMessage(processedData: unknown, userPrompt: string, chartType: string): MessagePayload;
}
```

### 类型说明

| 类型 | 说明 |
|------|------|
| `InputSourceType` | 输入源类型：文本、文件、图片 |
| `InputValidationResult` | 验证结果：成功或带错误信息的失败 |
| `ProcessedItem` | 处理后的文件项 |
| `MessagePayload` | 标准化的消息载荷，可直接发送 |

### 方法说明

| 方法 | 说明 |
|------|------|
| `canHandle(file)` | 判断该策略是否能处理给定的文件（通过 MIME 类型、扩展名等） |
| `validate(input)` | 验证输入是否合法（文件大小、格式等） |
| `process(input)` | 异步处理输入（读取文件内容、转换图片为 base64） |
| `buildMessage()` | 将处理后的数据构建为标准化的消息载荷 |

## 编排器（InputOrchestrator）

**文件位置**：`lib/input-strategies/orchestrator.ts`

编排器负责协调多个输入策略的执行流程。

```typescript
export class InputOrchestrator {
  private strategies: InputStrategy[];

  constructor(strategies: InputStrategy[]) {
    this.strategies = strategies;
  }

  resolve(file: File): InputStrategy | null;
  validateAll(files: File[]): ValidationResult;
  processAll(files: File[]): Promise<ProcessedItem[]>;
  merge(items: ProcessedItem[], userPrompt: string, chartType: string): MessagePayload;
  handleFiles(files: File[], userPrompt: string, chartType: string): Promise<OrchestrationResult>;
}
```

### 编排流程

```
文件列表
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 1. resolve(file) — 路由到正确的策略                      │
│    strategies.find(s => s.canHandle(file))              │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. validateAll(files) — 验证所有文件                     │
│    - 检查是否有策略能处理                                 │
│    - 调用策略的 validate()                               │
│    - 收集所有错误                                        │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. processAll(files) — 并行处理所有文件                  │
│    Promise.all(files.map(f => strategy.process(f)))     │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. merge(items, prompt, chartType) — 合并为统一载荷      │
│    - 纯文本 → { type: 'text', content: '...' }          │
│    - 纯图片 → { type: 'image', content: {...} }         │
│    - 混合   → { type: 'image', content: {...} }         │
└─────────────────────────────────────────────────────────┘
```

## 策略实现

### FileStrategy（文件策略）

**文件位置**：`lib/input-strategies/file-strategy.ts`

处理文本文件输入（如 `.txt`、`.md`、`.json` 等）。

```typescript
class FileStrategy implements InputStrategy {
  readonly sourceType = 'file';

  canHandle(file: File): boolean {
    // 检查 MIME 类型是否为文本类型
    return file.type.startsWith('text/') ||
           file.name.endsWith('.md') ||
           file.name.endsWith('.json');
  }

  validate(input: unknown): InputValidationResult {
    const file = input as File;
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: '文件大小超过 10MB 限制' };
    }
    return { valid: true };
  }

  async process(input: unknown): Promise<string> {
    const file = input as File;
    return file.text();  // 读取文件内容
  }

  buildMessage(processedData: unknown, userPrompt: string, chartType: string): MessagePayload {
    return {
      type: 'text',
      content: `${userPrompt}\n\n${processedData}`,
      sourceType: 'file',
    };
  }
}
```

### ImageStrategy（图片策略）

**文件位置**：`lib/input-strategies/image-strategy.ts`

处理图片文件输入（如 `.png`、`.jpg`、`.svg` 等）。

```typescript
class ImageStrategy implements InputStrategy {
  readonly sourceType = 'image';

  canHandle(file: File): boolean {
    return file.type.startsWith('image/');
  }

  validate(input: unknown): InputValidationResult {
    const file = input as File;
    if (file.size > 20 * 1024 * 1024) {
      return { valid: false, error: '图片大小超过 20MB 限制' };
    }
    return { valid: true };
  }

  async process(input: unknown): Promise<ImageData> {
    const file = input as File;
    const base64 = await fileToBase64(file);
    return {
      data: base64,
      mimeType: file.type,
    };
  }

  buildMessage(processedData: unknown, userPrompt: string, chartType: string): MessagePayload {
    return {
      type: 'image',
      content: {
        text: userPrompt,
        images: [processedData],
      },
      sourceType: 'image',
    };
  }
}
```

## 策略注册表

**文件位置**：`lib/input-strategies/registry.ts`

```typescript
import { fileStrategy } from './file-strategy';
import { imageStrategy } from './image-strategy';
import { InputOrchestrator } from './orchestrator';

// 预配置的编排器，图片策略优先
export const orchestrator = new InputOrchestrator([imageStrategy, fileStrategy]);

export { imageStrategy } from './image-strategy';
export { fileStrategy } from './file-strategy';
```

## 消息载荷

### 纯文本输入

```typescript
{
  type: 'text',
  content: '用户输入的文本',
  sourceType: 'text'
}
```

### 文件输入

```typescript
{
  type: 'text',
  content: '用户提示\n\n文件内容...',
  sourceType: 'file'
}
```

### 图片输入

```typescript
{
  type: 'image',
  content: {
    text: '用户提示',
    images: [{ data: 'base64...', mimeType: 'image/png' }]
  },
  sourceType: 'image'
}
```

### 混合输入（文本 + 图片）

```typescript
{
  type: 'image',
  content: {
    text: '用户提示\n\n文件内容...',
    images: [{ data: 'base64...', mimeType: 'image/png' }]
  },
  sourceType: 'image'
}
```

## 使用示例

### 在组件中使用

```typescript
import { orchestrator } from '@/lib/input-strategies/registry';

async function handleFileUpload(files: File[], userPrompt: string, chartType: string) {
  const result = await orchestrator.handleFiles(files, userPrompt, chartType);

  if (result.success) {
    // 发送消息
    onSendMessage(result.payload.content, chartType, result.payload.sourceType);
  } else {
    // 显示错误
    result.errors.forEach(err => {
      showError(`${err.fileName}: ${err.error}`);
    });
  }
}
```

### 单独使用策略

```typescript
import { imageStrategy } from '@/lib/input-strategies/registry';

// 验证图片
const validation = imageStrategy.validate(file);
if (!validation.valid) {
  showError(validation.error);
  return;
}

// 处理图片
const imageData = await imageStrategy.process(file);

// 构建消息
const message = imageStrategy.buildMessage(imageData, '描述这个图片', 'flowchart');
```

## 扩展新输入类型

### 1. 实现策略接口

```typescript
// lib/input-strategies/video-strategy.ts
import type { InputStrategy } from '@/lib/types/input-strategy';

class VideoStrategy implements InputStrategy {
  readonly sourceType = 'video';

  canHandle(file: File): boolean {
    return file.type.startsWith('video/');
  }

  validate(input: unknown): InputValidationResult {
    const file = input as File;
    if (file.size > 100 * 1024 * 1024) {
      return { valid: false, error: '视频大小超过 100MB 限制' };
    }
    return { valid: true };
  }

  async process(input: unknown): Promise<unknown> {
    // 处理视频（如提取关键帧）
    const file = input as File;
    // ...
  }

  buildMessage(processedData: unknown, userPrompt: string, chartType: string): MessagePayload {
    return {
      type: 'image',
      content: {
        text: userPrompt,
        images: [processedData],
      },
      sourceType: 'image',
    };
  }
}

export const videoStrategy = new VideoStrategy();
```

### 2. 注册到编排器

```typescript
// lib/input-strategies/registry.ts
import { videoStrategy } from './video-strategy';

export const orchestrator = new InputOrchestrator([
  imageStrategy,
  videoStrategy,  // 新增
  fileStrategy,
]);
```

### 3. 更新类型定义

```typescript
// lib/types/input-strategy.ts
export type InputSourceType = 'text' | 'file' | 'image' | 'video';
```

## 错误处理

### 验证错误

```typescript
const validation = orchestrator.validateAll(files);
if (!validation.valid) {
  validation.errors.forEach(err => {
    console.error(`${err.fileName}: ${err.error}`);
  });
}
```

### 处理错误

```typescript
try {
  const items = await orchestrator.processAll(files);
} catch (error) {
  console.error('文件处理失败:', error.message);
}
```

### 编排错误

```typescript
const result = await orchestrator.handleFiles(files, prompt, chartType);
if (!result.success) {
  result.errors.forEach(err => {
    showError(err.error);
  });
}
```

## 最佳实践

1. **策略顺序**：图片策略应优先于文件策略（因为图片 MIME 类型更明确）
2. **大小限制**：在 validate() 中检查文件大小，避免内存溢出
3. **错误信息**：提供清晰的错误信息，帮助用户理解问题
4. **异步处理**：process() 应返回 Promise，支持并行处理
5. **类型安全**：使用 TypeScript 类型守卫而非类型断言

## 相关文件

- `lib/types/input-strategy.ts` — 接口定义
- `lib/input-strategies/orchestrator.ts` — 编排器实现
- `lib/input-strategies/file-strategy.ts` — 文件策略实现
- `lib/input-strategies/image-strategy.ts` — 图片策略实现
- `lib/input-strategies/registry.ts` — 策略注册表

---

## 相关文档

- [架构概览](./overview.md) — 整体架构设计
- [图表格式策略模式](./diagram-strategy.md) — DiagramStrategy 接口详解
- [图片处理管线](./image-processing.md) — 图片三层降级策略详解
- [API 接口文档](../api/endpoints.md) — 后端 API 接口说明
- [开发扩展指南](../guides/extend-diagram.md) — 如何添加新输入类型
