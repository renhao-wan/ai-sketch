# 开发扩展指南

本文档介绍如何扩展 AI Sketch 项目，包括添加新图表格式、新输入类型等功能。

## 添加新图表格式

### 步骤 1：实现策略接口

创建新文件 `lib/strategies/new-format-strategy.ts`：

```typescript
/**
 * 新图表格式策略实现
 */

import type { DiagramStrategy, ValidationResult } from '@/lib/types/diagram-strategy';
import { createExportBlob, buildImagePrompt } from './helpers';
import { CHART_TYPES } from '@/lib/diagram/constants';

class NewFormatStrategy implements DiagramStrategy {
  // ── 元数据 ──
  readonly format = 'newformat' as const;
  readonly displayName = 'New Format';
  readonly codeLanguage = 'json';  // 或 'markdown'、'xml'
  readonly fileExtension = 'ext';
  readonly mimeType = 'application/json';

  // ── 服务端方法 ──

  /**
   * 返回 LLM 系统提示词
   * 指导 LLM 如何生成该格式的图表代码
   */
  getSystemPrompt(): string {
    return `你是一个图表生成助手。请根据用户描述生成 New Format 格式的图表代码。

规则：
1. 输出必须是有效的 JSON 数组
2. 每个元素必须包含 type、x、y 属性
3. ...（其他格式特定规则）`;
  }

  /**
   * 返回 LLM 用户提示词
   * @param userInput - 用户输入的描述
   * @param chartType - 图表类型（flowchart、sequence 等）
   */
  getUserPrompt(userInput: string, chartType: string): string {
    return `请根据以下描述生成 ${chartType} 类型的图表：

${userInput}`;
  }

  // ── 客户端方法 ──

  /**
   * 后处理 LLM 输出
   * - 去除代码围栏（```json ... ```）
   * - 修复格式问题
   */
  postProcess(rawCode: string): string {
    if (!rawCode || typeof rawCode !== 'string') return rawCode;

    // 去除代码围栏
    let processed = rawCode
      .replace(/^```(?:json|newformat)?\s*\n?/gm, '')
      .replace(/\n?```\s*$/gm, '')
      .trim();

    // 其他格式特定的清理逻辑
    // ...

    return processed;
  }

  /**
   * 优化图表代码
   * 例如：对齐元素、优化布局等
   */
  optimize(code: string): string {
    // 如果不需要优化，直接返回
    return code;
  }

  /**
   * 验证代码是否可渲染
   */
  validate(code: string): ValidationResult {
    try {
      const cleaned = code.trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        return { valid: false, error: '解析结果不是 JSON 数组' };
      }

      // 验证每个元素的必要属性
      for (const element of parsed) {
        if (!element.type) {
          return { valid: false, error: '元素缺少 type 属性' };
        }
        if (element.x === undefined || element.y === undefined) {
          return { valid: false, error: '元素缺少 x 或 y 属性' };
        }
      }

      return { valid: true, data: parsed };
    } catch (e) {
      if (e instanceof SyntaxError) {
        return { valid: false, error: 'JSON 语法错误：' + e.message };
      }
      return { valid: false, error: '解析失败：' + (e as Error).message };
    }
  }

  /**
   * 创建导出文件 Blob
   */
  createExportBlob(code: string): Blob {
    return createExportBlob(code, this.mimeType);
  }

  /**
   * 生成图片转图表的提示词
   */
  generateImagePrompt(chartType: string): string {
    return buildImagePrompt(chartType, 'New Format', CHART_TYPES, '将图片里的内容转换为新格式');
  }
}

export const newFormatStrategy: DiagramStrategy = new NewFormatStrategy();
```

### 步骤 2：注册到策略注册表

编辑 `lib/strategies/registry.ts`：

```typescript
import type { DiagramFormat, DiagramStrategy } from '@/lib/types/diagram-strategy';
import { excalidrawStrategy } from './excalidraw-strategy';
import { mermaidStrategy } from './mermaid-strategy';
import { drawioStrategy } from './drawio-strategy';
import { newFormatStrategy } from './new-format-strategy';  // 新增

const strategies: Record<DiagramFormat, DiagramStrategy> = {
  excalidraw: excalidrawStrategy,
  mermaid: mermaidStrategy,
  drawio: drawioStrategy,
  newformat: newFormatStrategy,  // 新增
};

export function getStrategy(format: DiagramFormat): DiagramStrategy {
  const strategy = strategies[format];
  if (!strategy) throw new Error(`Unknown diagram format: ${format}`);
  return strategy;
}
```

### 步骤 3：更新类型定义

编辑 `lib/types/diagram-strategy.ts`：

```typescript
export type DiagramFormat = 'excalidraw' | 'mermaid' | 'drawio' | 'newformat';
```

### 步骤 4：创建画布组件

创建 `components/canvases/NewFormatCanvas.tsx`：

```typescript
'use client';

import { useEffect, useRef } from 'react';

interface NewFormatCanvasProps {
  code: string;
  className?: string;
}

export default function NewFormatCanvas({ code, className }: NewFormatCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !code) return;

    try {
      const elements = JSON.parse(code);
      // 渲染逻辑
      renderDiagram(containerRef.current, elements);
    } catch (error) {
      console.error('渲染失败:', error);
    }
  }, [code]);

  return <div ref={containerRef} className={className} />;
}

function renderDiagram(container: HTMLDivElement, elements: unknown[]) {
  // 实现渲染逻辑
}
```

### 步骤 5：注册画布组件

编辑 `components/canvases/DiagramCanvas.tsx`：

```typescript
import dynamic from 'next/dynamic';

const ExcalidrawCanvas = dynamic(() => import('./ExcalidrawCanvas'), { ssr: false });
const MermaidCanvas = dynamic(() => import('./MermaidCanvas'), { ssr: false });
const DrawioCanvas = dynamic(() => import('./DrawioCanvas'), { ssr: false });
const NewFormatCanvas = dynamic(() => import('./NewFormatCanvas'), { ssr: false });  // 新增

interface DiagramCanvasProps {
  format: string;
  code: string;
  className?: string;
}

export default function DiagramCanvas({ format, code, className }: DiagramCanvasProps) {
  switch (format) {
    case 'excalidraw':
      return <ExcalidrawCanvas code={code} className={className} />;
    case 'mermaid':
      return <MermaidCanvas code={code} className={className} />;
    case 'drawio':
      return <DrawioCanvas code={code} className={className} />;
    case 'newformat':  // 新增
      return <NewFormatCanvas code={code} className={className} />;
    default:
      return <div>不支持的格式: {format}</div>;
  }
}
```

### 步骤 6：更新设置页面

编辑 `components/editor/FormatSelector.tsx`，添加新格式选项：

```typescript
const formats = [
  { id: 'excalidraw', name: 'Excalidraw', icon: '🎨' },
  { id: 'mermaid', name: 'Mermaid', icon: '📊' },
  { id: 'drawio', name: 'Draw.io', icon: '📐' },
  { id: 'newformat', name: 'New Format', icon: '✨' },  // 新增
];
```

### 步骤 7：更新国际化文件

编辑 `lib/locales/zh.ts` 和 `lib/locales/en.ts`：

```typescript
// zh.ts
export default {
  // ...
  'format.newformat': '新格式',
  // ...
};

// en.ts
export default {
  // ...
  'format.newformat': 'New Format',
  // ...
};
```

---

## 添加新输入类型

### 步骤 1：实现策略接口

创建新文件 `lib/input-strategies/video-strategy.ts`：

```typescript
/**
 * 视频输入策略
 */

import type { InputStrategy, InputValidationResult, MessagePayload } from '@/lib/types/input-strategy';

class VideoStrategy implements InputStrategy {
  readonly sourceType = 'video';

  /**
   * 判断是否能处理该文件
   */
  canHandle(file: File): boolean {
    return file.type.startsWith('video/');
  }

  /**
   * 验证输入
   */
  validate(input: unknown): InputValidationResult {
    const file = input as File;

    // 检查文件大小（100MB 限制）
    if (file.size > 100 * 1024 * 1024) {
      return { valid: false, error: '视频大小超过 100MB 限制' };
    }

    // 检查视频格式
    const supportedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!supportedTypes.includes(file.type)) {
      return { valid: false, error: '不支持的视频格式' };
    }

    return { valid: true };
  }

  /**
   * 处理视频（如提取关键帧）
   */
  async process(input: unknown): Promise<unknown> {
    const file = input as File;

    // 提取视频关键帧
    const frames = await extractVideoFrames(file);

    return {
      frames,
      duration: await getVideoDuration(file),
    };
  }

  /**
   * 构建消息
   */
  buildMessage(processedData: unknown, userPrompt: string, chartType: string): MessagePayload {
    const { frames } = processedData as { frames: string[]; duration: number };

    return {
      type: 'image',
      content: {
        text: userPrompt,
        images: frames.map(data => ({ data, mimeType: 'image/jpeg' })),
      },
      sourceType: 'image',
    };
  }
}

// 辅助函数
async function extractVideoFrames(file: File): Promise<string[]> {
  // 实现视频帧提取
  return [];
}

async function getVideoDuration(file: File): Promise<number> {
  // 实现视频时长获取
  return 0;
}

export const videoStrategy = new VideoStrategy();
```

### 步骤 2：注册到编排器

编辑 `lib/input-strategies/registry.ts`：

```typescript
import { fileStrategy } from './file-strategy';
import { imageStrategy } from './image-strategy';
import { videoStrategy } from './video-strategy';  // 新增
import { InputOrchestrator } from './orchestrator';

export const orchestrator = new InputOrchestrator([
  imageStrategy,
  videoStrategy,  // 新增（优先级高于 fileStrategy）
  fileStrategy,
]);

export { imageStrategy } from './image-strategy';
export { videoStrategy } from './video-strategy';  // 新增
export { fileStrategy } from './file-strategy';
```

### 步骤 3：更新类型定义

编辑 `lib/types/input-strategy.ts`：

```typescript
export type InputSourceType = 'text' | 'file' | 'image' | 'video';
```

---

## 添加新图表类型

### 步骤 1：更新常量定义

编辑 `lib/diagram/constants.ts`：

```typescript
export const CHART_TYPES = [
  // ...现有类型
  { id: 'newchart', name: '新图表类型', icon: '✨' },
];
```

### 步骤 2：更新提示词

编辑相应的提示词文件（如 `lib/prompts/excalidraw.ts`）：

```typescript
export function buildExcalidrawUserPrompt(userInput: string, chartType: string): string {
  const chartTypeInstructions: Record<string, string> = {
    // ...现有类型
    newchart: '生成新图表类型的代码，要求...',
  };

  const instruction = chartTypeInstructions[chartType] || '生成图表代码';

  return `${instruction}

用户描述：
${userInput}`;
}
```

### 步骤 3：更新国际化文件

编辑 `lib/locales/zh.ts` 和 `lib/locales/en.ts`：

```typescript
// zh.ts
export default {
  // ...
  'chartType.newchart': '新图表类型',
  // ...
};

// en.ts
export default {
  // ...
  'chartType.newchart': 'New Chart Type',
  // ...
};
```

---

## 添加新 AI 操作

### 步骤 1：更新类型定义

编辑 `lib/prompts/types.ts`：

```typescript
export type AIActionType = 'beautify' | 'layout' | 'simplify' | 'explain' | 'newaction';
```

### 步骤 2：实现提示词

编辑 `lib/prompts/ai-actions.ts`：

```typescript
export function getActionSystemPrompt(action: AIActionType, format: DiagramFormat): string {
  const prompts: Record<AIActionType, string> = {
    // ...现有操作
    newaction: '你是一个图表优化助手，执行新操作...',
  };

  return prompts[action];
}

export function getActionUserPrompt(action: AIActionType, code: string, format: DiagramFormat): string {
  switch (action) {
    // ...现有操作
    case 'newaction':
      return `请对以下 ${format} 代码执行新操作：\n\n${code}`;
    default:
      return code;
  }
}
```

### 步骤 3：更新 UI 组件

编辑 `components/ai/FloatingActions.tsx`：

```typescript
const actions = [
  // ...现有操作
  { id: 'newaction', label: '新操作', icon: '✨' },
];
```

---

## 添加新主题

### 步骤 1：定义主题变量

编辑 `app/globals.css`：

```css
[data-theme="newtheme"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #333333;
  --text-secondary: #666666;
  --accent: #007bff;
  /* ...其他变量 */
}
```

### 步骤 2：注册主题

编辑 `lib/utils/theme-utils.ts`：

```typescript
export const themes = [
  // ...现有主题
  { id: 'newtheme', name: '新主题', icon: '🎨' },
];
```

### 步骤 3：更新国际化文件

编辑 `lib/locales/zh.ts` 和 `lib/locales/en.ts`：

```typescript
// zh.ts
export default {
  // ...
  'theme.newtheme': '新主题',
  // ...
};

// en.ts
export default {
  // ...
  'theme.newtheme': 'New Theme',
  // ...
};
```

---

## 开发规范

### 代码风格

- 使用 TypeScript strict 模式
- 避免使用 `any`，使用 `unknown` 或具体类型
- 使用 JSDoc 注释说明函数和类型

### 文件命名

- 组件：PascalCase（如 `DiagramCanvas.tsx`）
- 工具函数：camelCase（如 `optimizeArrows.ts`）
- 类型定义：camelCase（如 `diagram-strategy.ts`）
- 常量：UPPER_SNAKE_CASE 或 camelCase

### 提交规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <subject>

# 示例
feat(strategy): 添加新图表格式支持
fix(canvas): 修复渲染问题
docs(guide): 更新扩展指南
```

### 测试

目前项目未配置测试框架，建议添加：

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

---

## 常见问题

### Q: 如何调试 LLM 提示词？

A: 在浏览器开发者工具的 Network 面板中查看 `/api/generate` 请求的响应，可以看到完整的 LLM 输出。

### Q: 如何添加新的 LLM 提供商？

A: 编辑 `lib/llm/client.ts`，在 `callLLM` 函数中添加新的 API 调用逻辑。

### Q: 如何修改数据库表结构？

A: 编辑 `lib/db/index.ts` 中的 `CREATE TABLE` 语句，然后手动迁移数据或重新创建数据库。

### Q: 如何添加新的 API 接口？

A: 在 `app/api/` 目录下创建新的 `route.ts` 文件，参考现有接口实现。

---

## 相关文档

- [架构概览](../architecture/overview.md)
- [图表格式策略模式](../architecture/diagram-strategy.md)
- [输入类型策略模式](../architecture/input-strategy.md)
- [API 接口文档](../api/endpoints.md)
