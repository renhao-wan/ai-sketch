# 统一文件上传逻辑封装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页和编辑器的文件/图片上传逻辑统一到一个自定义 Hook 中，消除代码重复，使未来修改只需改一处。

**Architecture:** 创建 `useFileUpload` 自定义 Hook 封装 `InputOrchestrator` 调用和附件状态管理。首页 `AIPromptBox` 和编辑器 `AICopilotPanel` 都通过此 Hook 处理文件上传，各自保留独立的拖拽/点击 UI 逻辑。删除不再需要的 `ImageUpload` 组件。

**Tech Stack:** React 19 hooks, TypeScript strict, existing InputOrchestrator/InputStrategy pattern

---

### Task 1: 创建 `useFileUpload` Hook

**Files:**
- Create: `composables/useFileUpload.ts`

- [ ] **Step 1: 创建 Hook 文件，定义接口和基本结构**

```typescript
/**
 * useFileUpload — 统一的文件上传 Hook
 *
 * 封装 InputOrchestrator 调用和附件状态管理，
 * 供 AIPromptBox（首页）和 AICopilotPanel（编辑器）共用。
 *
 * @example
 * const { attachments, payload, attachStatus, attachError, handleFiles, clearAttachments, canSend, getSourceType } = useFileUpload();
 * await handleFiles(files, prompt); // 首页场景
 * await handleFiles(files);         // 编辑器场景
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { imageStrategy, orchestrator } from '@/lib/input-strategies/registry';
import type { DiagramFormat } from '@/types/diagram-strategy';
import type { MessagePayload } from '@/types/input-strategy';

type AttachStatus = '' | 'processing' | 'success' | 'error';

interface UseFileUploadOptions {
  /** 图表格式，用于 ImageStrategy 生成默认 prompt */
  diagramFormat?: DiagramFormat;
}

interface UseFileUploadReturn {
  /** 当前附件列表 */
  attachments: File[];
  /** 编排器产出的消息 payload */
  payload: MessagePayload | null;
  /** 附件处理状态 */
  attachStatus: AttachStatus;
  /** 错误信息 */
  attachError: string;

  /** 处理文件列表，调用编排器。prompt 可选（首页传，编辑器不传） */
  handleFiles: (files: File[], prompt?: string) => Promise<void>;
  /** 清除所有附件状态 */
  clearAttachments: () => void;

  /** 判断是否可以发送（有 prompt 或有成功附件） */
  canSend: (hasPrompt: boolean) => boolean;
  /** 根据 payload 返回 sourceType */
  getSourceType: () => 'text' | 'file' | 'image';
  /** 手动设置错误状态（用于调用方的 catch 块） */
  setAttachError: (error: string) => void;
  /** 手动设置附件状态 */
  setAttachStatus: (status: AttachStatus) => void;
}

export function useFileUpload(options?: UseFileUploadOptions): UseFileUploadReturn {
  const [attachments, setAttachments] = useState<File[]>([]);
  const [payload, setPayload] = useState<MessagePayload | null>(null);
  const [attachStatus, setAttachStatus] = useState<AttachStatus>('');
  const [attachError, setAttachError] = useState('');

  const handleFiles = useCallback(async (files: File[], prompt?: string) => {
    if (files.length === 0) return;

    setAttachments([]);
    setPayload(null);
    setAttachStatus('processing');
    setAttachError('');

    // 为图片策略设置图表格式
    if (options?.diagramFormat) {
      imageStrategy.setDiagramFormat(options.diagramFormat);
    }

    const result = await orchestrator.handleFiles(files, prompt || '', 'auto');
    if (result.success) {
      setAttachments(files);
      setPayload(result.payload);
      setAttachStatus('success');
    } else {
      setAttachError(result.errors.map(e => `${e.fileName}: ${e.error}`).join('; '));
      setAttachStatus('error');
    }
  }, [options?.diagramFormat]);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setPayload(null);
    setAttachStatus('');
    setAttachError('');
  }, []);

  const canSend = useCallback((hasPrompt: boolean): boolean => {
    return hasPrompt || (attachStatus === 'success' && payload !== null);
  }, [attachStatus, payload]);

  const getSourceType = useCallback((): 'text' | 'file' | 'image' => {
    if (!payload) return 'text';
    return payload.type === 'image' ? 'image' : 'file';
  }, [payload]);

  return {
    attachments,
    payload,
    attachStatus,
    attachError,
    handleFiles,
    clearAttachments,
    canSend,
    getSourceType,
    setAttachError,
    setAttachStatus,
  };
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `pnpm build` (or `npx tsc --noEmit`)
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add composables/useFileUpload.ts
git commit -m "feat: 添加 useFileUpload Hook，封装编排器调用和附件状态管理"
```

---

### Task 2: 改造 AIPromptBox 使用 useFileUpload

**Files:**
- Modify: `components/AIPromptBox.tsx`

- [ ] **Step 1: 替换手动状态为 Hook 调用**

在 `AIPromptBox` 组件中，删除以下手动状态声明（第 39-43 行）：

```typescript
// 删除这些行
const [attachments, setAttachments] = useState<File[]>([]);
const [attachStatus, setAttachStatus] = useState<'' | 'processing' | 'success' | 'error'>('');
const [attachError, setAttachError] = useState('');
const [payload, setPayload] = useState<MessagePayload | null>(null);
```

替换为 Hook 调用：

```typescript
const { attachments, payload, attachStatus, attachError, handleFiles: handleFilesRaw, clearAttachments, getSourceType, setAttachError, setAttachStatus } = useFileUpload({
  diagramFormat: activeFormat as DiagramFormat,
});
```

- [ ] **Step 2: 替换 handleFiles 函数**

删除原来的 `handleFiles` 函数（第 54-73 行）和 `clearAttachments` 函数（第 83-90 行），替换为：

```typescript
const handleFiles = async (files: File[]) => {
  await handleFilesRaw(files, prompt);
};

const clearAttachmentsLocal = () => {
  clearAttachments();
  if (fileInputRef.current) fileInputRef.current.value = '';
  if (imageInputRef.current) imageInputRef.current.value = '';
};
```

- [ ] **Step 3: 更新 clearAttachments 引用**

在组件中将所有 `clearAttachments()` 调用替换为 `clearAttachmentsLocal()`。

- [ ] **Step 4: 更新 canGenerate 函数**

```typescript
const canGenerate = (): boolean => {
  if (isGenerating) return false;
  return !!(prompt.trim() || (attachStatus === 'success' && payload));
};
```

（这个逻辑不变，但 `payload` 现在来自 Hook）

- [ ] **Step 5: 更新 handleGenerate 函数**

```typescript
const handleGenerate = async () => {
  if (!canGenerate()) return;
  setIsGenerating(true);

  try {
    if (attachStatus === 'success' && payload) {
      setInitData({ type: payload.type, data: payload.content, format: activeFormat as DiagramFormat });
      router.push(`/editor?source=${getSourceType()}`);
    } else if (prompt.trim()) {
      setInitData({ type: 'text', data: prompt.trim(), format: activeFormat as DiagramFormat });
      router.push('/editor?source=text');
    }
  } catch (err) {
    setAttachError((err as Error).message);
    setAttachStatus('error');
  } finally {
    setIsGenerating(false);
  }
};
```

注意：`getSourceType()` 替代了原来的 `payload.type === 'image' ? 'image' : 'file'`。

- [ ] **Step 6: 清理 import**

删除不再需要的 import：

```typescript
// 删除
import { imageStrategy, orchestrator } from '@/lib/input-strategies/registry';
import type { MessagePayload } from '@/types/input-strategy';
```

添加新的 import：

```typescript
import { useFileUpload } from '@/composables/useFileUpload';
```

保留 `DiagramFormat` 类型 import（用于 `diagramFormat` 参数）。

- [ ] **Step 7: 更新 renderAttachments 中的 clearAttachments 引用**

确保 `renderAttachments` 函数中的清除按钮调用 `clearAttachmentsLocal`：

```typescript
<button onClick={clearAttachmentsLocal} className="...">
```

- [ ] **Step 8: 验证功能正常**

Run: `pnpm dev`
手动测试：
1. 在首页输入 prompt，不附加文件，点击生成 → 应跳转编辑器
2. 附加 .md 文件，点击生成 → 应跳转编辑器并自动发送
3. 附加图片，点击生成 → 应跳转编辑器并自动发送
4. 拖拽文件到输入框 → 应显示附件 chips
5. 清除附件 → chips 消失

- [ ] **Step 9: Commit**

```bash
git add components/AIPromptBox.tsx
git commit -m "refactor: AIPromptBox 改用 useFileUpload Hook"
```

---

### Task 3: 改造 AICopilotPanel 使用 useFileUpload

**Files:**
- Modify: `components/AICopilotPanel.tsx`

- [ ] **Step 1: 删除手动状态和直接调用 strategy 的代码**

删除以下状态声明（约第 90-95 行）：

```typescript
// 删除
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [fileContent, setFileContent] = useState('');
const [fileStatus, setFileStatus] = useState<'' | 'parsing' | 'success' | 'error'>('');
const [fileError, setFileError] = useState('');
const [selectedImage, setSelectedImage] = useState<any>(null);
const [showImageUpload, setShowImageUpload] = useState(false);
```

删除以下函数：
- `handleFileChange`（文件选择处理）
- `handleClearFile`（清除文件）
- `handleToggleImage`（切换图片上传面板）
- `handleImageSubmit`（图片发送）

- [ ] **Step 2: 添加 Hook 调用和拖拽状态**

```typescript
import { useFileUpload } from '@/composables/useFileUpload';

// 在组件内部
const { attachments, payload, attachStatus, attachError, handleFiles, clearAttachments, canSend, getSourceType, setAttachError, setAttachStatus } = useFileUpload();

const [isDragging, setIsDragging] = useState(false);
const dragCounterRef = useRef(0);
const fileInputRef = useRef<HTMLInputElement>(null);
const imageInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: 添加拖拽事件处理（仅输入框区域）**

```typescript
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounterRef.current++;
  if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounterRef.current--;
  if (dragCounterRef.current === 0) setIsDragging(false);
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
  dragCounterRef.current = 0;
  handleFiles(Array.from(e.dataTransfer.files));
};
```

- [ ] **Step 4: 更新 handleSend 函数**

```typescript
const handleSend = () => {
  if (!canSend(!!prompt.trim())) return;

  if (payload) {
    onSendMessage(payload.content, chartType, getSourceType());
  } else if (prompt.trim()) {
    onSendMessage(prompt.trim(), chartType, 'text');
  }

  clearAttachments();
  if (fileInputRef.current) fileInputRef.current.value = '';
  if (imageInputRef.current) imageInputRef.current.value = '';
  setPrompt('');
};
```

- [ ] **Step 5: 更新 canSend 逻辑**

```typescript
const canSendNow = (): boolean => {
  if (isGenerating) return false;
  return canSend(!!prompt.trim());
};
```

- [ ] **Step 6: 添加附件预览 chips**

在 textarea 下方添加附件状态显示（参考 AIPromptBox 的 `renderAttachments`）：

```typescript
{attachments.length > 0 && (
  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)]">
    {attachStatus === 'processing' && <Loader2 size={13} className="animate-spin text-[var(--muted)] flex-shrink-0" />}
    {attachStatus === 'success' && <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />}
    {attachStatus === 'error' && <AlertCircle size={13} className="text-red-500 flex-shrink-0" />}
    <span className="text-xs text-[var(--fg)] truncate flex-1">
      {attachments.length === 1 ? attachments[0].name : `${attachments.length} 个文件`}
    </span>
    {attachStatus === 'error' && <span className="text-[10px] text-red-500 flex-shrink-0">{attachError}</span>}
    <button onClick={() => { clearAttachments(); if (fileInputRef.current) fileInputRef.current.value = ''; if (imageInputRef.current) imageInputRef.current.value = ''; }} className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex-shrink-0 ml-1">
      <X size={13} />
    </button>
  </div>
)}
```

- [ ] **Step 7: 更新输入框区域，添加拖拽支持**

将输入框区域的 div 添加拖拽事件和高亮效果：

```typescript
<div
  className="relative ..."
  onDragEnter={handleDragEnter}
  onDragLeave={handleDragLeave}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
>
  {isDragging && (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--accent-indigo)]/5 border-2 border-dashed border-[var(--accent-indigo)]/30 rounded-xl pointer-events-none">
      <span className="text-sm font-medium text-[var(--accent-indigo)]">拖放文件到此处</span>
    </div>
  )}
  <textarea ... />
  {/* 附件 chips */}
</div>
```

- [ ] **Step 8: 更新底部操作栏按钮**

```typescript
{/* 隐藏的文件 input */}
<input ref={fileInputRef} type="file" accept=".md,.txt,image/*" multiple className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
<input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files || []))} />

{/* Paperclip 按钮 */}
<button onClick={() => fileInputRef.current?.click()} ...>
  <Paperclip size={18} />
</button>

{/* Image 按钮 */}
<button onClick={() => imageInputRef.current?.click()} ...>
  <Image size={18} />
</button>
```

- [ ] **Step 9: 删除 ImageUpload 相关代码**

删除 `showImageUpload` 条件渲染块（原来会切换到 ImageUpload 视图）。

删除 `import ImageUpload from './ImageUpload'`。

- [ ] **Step 10: 清理不再需要的 import**

删除：
```typescript
import { fileStrategy, imageStrategy } from '@/lib/input-strategies/registry';
```

保留其他 import。添加：
```typescript
import { useFileUpload } from '@/composables/useFileUpload';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'; // 如果尚未 import
```

- [ ] **Step 11: 验证功能正常**

Run: `pnpm dev`
手动测试：
1. 在编辑器侧边栏输入纯文本 → 发送正常
2. 点击 Paperclip 按钮选择 .md 文件 → 显示附件 chips
3. 点击 Image 按钮选择图片 → 显示附件 chips
4. 拖拽文件到输入框区域 → 显示拖拽高亮，释放后显示附件 chips
5. 多文件选择 → 显示文件数量
6. 清除附件 → chips 消失
7. 有附件时点击发送 → 正确调用 onSendMessage

- [ ] **Step 12: Commit**

```bash
git add components/AICopilotPanel.tsx
git commit -m "refactor: AICopilotPanel 改用 useFileUpload Hook，支持多文件和拖拽"
```

---

### Task 4: 删除 ImageUpload 组件

**Files:**
- Delete: `components/ImageUpload.tsx`

- [ ] **Step 1: 确认无其他引用**

搜索项目中是否还有其他文件引用 `ImageUpload`：

Run: `grep -r "ImageUpload" --include="*.tsx" --include="*.ts" .`

Expected: 只有 AICopilotPanel.tsx 中的 import（已在 Task 3 中删除），无其他引用。

- [ ] **Step 2: 删除文件**

```bash
rm components/ImageUpload.tsx
```

- [ ] **Step 3: 验证构建通过**

Run: `pnpm build`
Expected: 构建成功，无类型错误

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: 删除 ImageUpload 组件，功能已统一到 useFileUpload Hook"
```

---

### Task 5: 最终验证和清理

**Files:**
- 无新增/修改文件

- [ ] **Step 1: 完整功能测试**

Run: `pnpm dev`

**首页测试：**
1. 纯文本 prompt → 生成
2. 附带 .md 文件 → 生成
3. 附带图片 → 生成
4. 拖拽文件 → 附件 chips
5. 多文件（图片+.md）→ 编排器正确处理

**编辑器测试：**
1. 纯文本发送
2. Paperclip 选择文件 → chips → 发送
3. Image 选择图片 → chips → 发送
4. 拖拽文件到输入框 → 高亮 → chips → 发送
5. 多文件选择 → 显示数量
6. 清除附件 → 恢复正常
7. 会话历史正确保存

- [ ] **Step 2: 检查无残留代码**

确认以下已删除：
- `components/ImageUpload.tsx` 文件
- AICopilotPanel 中的 `selectedFile`、`fileContent`、`fileStatus`、`fileError`、`selectedImage`、`showImageUpload` 状态
- AICopilotPanel 中的 `handleFileChange`、`handleClearFile`、`handleToggleImage`、`handleImageSubmit` 函数
- AIPromptBox 中的 `orchestrator`、`imageStrategy` 直接 import

- [ ] **Step 3: 最终 Commit（如有遗漏修复）**

```bash
git add -A
git commit -m "refactor: 统一文件上传逻辑封装完成"
```
