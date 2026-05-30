# 统一文件上传逻辑封装设计

## 背景

首页 (AIPromptBox) 和编辑器 (AICopilotPanel) 的文件/图片上传逻辑存在显著差异：

- **首页**：使用 `InputOrchestrator` 统一编排，支持多文件、拖拽上传
- **编辑器**：直接调用 `fileStrategy` / `imageStrategy`，仅单文件，无文件拖拽

用户要求统一为首页的方式，并封装为独立模块，使未来修改只需改一处。

## 设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 封装方式 | 自定义 Hook (`useFileUpload`) | 首页和编辑器 UI 差异大，Hook 封装逻辑、UI 各自灵活 |
| 多文件支持 | 编辑器也支持多文件 | 与首页一致，编排器原生支持 |
| 拖拽范围 | 编辑器仅输入框区域 | 用户选择，避免误操作 |
| `handleFiles` 的 prompt 参数 | 可选 `prompt?: string` | 首页上传时有 prompt，编辑器可能先上传再输入 |
| `ImageUpload.tsx` | 删除 | 文件和图片统一走 `handleFiles`，不再需要单独视图 |

## 架构

### 新增：`composables/useFileUpload.ts`

核心 hook，封装编排器调用和附件状态管理。

```typescript
interface UseFileUploadOptions {
  diagramFormat?: DiagramFormat;
}

interface UseFileUploadReturn {
  // 状态
  attachments: File[];
  payload: MessagePayload | null;
  attachStatus: '' | 'processing' | 'success' | 'error';
  attachError: string;

  // 操作
  handleFiles: (files: File[], prompt?: string) => Promise<void>;
  clearAttachments: () => void;

  // 派生
  canSend: (hasPrompt: boolean) => boolean;
  getSourceType: () => 'text' | 'file' | 'image';
}

function useFileUpload(options?: UseFileUploadOptions): UseFileUploadReturn;
```

**内部逻辑**：

1. `handleFiles(files, prompt?)`：
   - 清除旧附件状态
   - 设置 `attachStatus = 'processing'`
   - 调用 `imageStrategy.setDiagramFormat(diagramFormat)`
   - 调用 `orchestrator.handleFiles(files, prompt || '', 'auto')`
   - 成功：设置 `attachments`、`payload`、`attachStatus = 'success'`
   - 失败：设置 `attachError`、`attachStatus = 'error'`

2. `clearAttachments()`：重置所有附件状态

3. `canSend(hasPrompt)`：`hasPrompt || (attachStatus === 'success' && payload !== null)`

4. `getSourceType()`：根据 `payload.type` 返回 `'file'` 或 `'image'`，无 payload 时返回 `'text'`

### 改造：`components/AIPromptBox.tsx`

**删除**：
- `attachments`、`attachStatus`、`attachError`、`payload` 四个 `useState`
- 直接调用 `orchestrator` 和 `imageStrategy` 的代码

**引入**：
- `useFileUpload` hook

**保持不变**：
- 拖拽逻辑（`handleDragEnter/Leave/Over/Drop`）— 组件自行实现
- 点击触发（`fileInputRef`、`imageInputRef`）— 组件自行实现
- `handleGenerate` — 改为读取 hook 的 `payload` 和 `getSourceType()`

**改造后的关键代码**：

```tsx
const { attachments, payload, attachStatus, attachError, handleFiles, clearAttachments, getSourceType } = useFileUpload();

const handleFilesFromUI = async (files: File[]) => {
  await handleFiles(files, prompt);
};

const handleGenerate = async () => {
  if (attachStatus === 'success' && payload) {
    setInitData({ type: payload.type, data: payload.content, format: activeFormat });
    router.push(`/editor?source=${getSourceType()}`);
  } else if (prompt.trim()) {
    setInitData({ type: 'text', data: prompt.trim(), format: activeFormat });
    router.push('/editor?source=text');
  }
};
```

### 改造：`components/AICopilotPanel.tsx`

**删除**：
- `selectedFile`、`fileContent`、`fileStatus`、`fileError`、`selectedImage`、`showImageUpload` 六个 `useState`
- `handleFileChange`、`handleClearFile`、`handleToggleImage`、`handleImageSubmit` 函数
- `ImageUpload` 组件引用
- 直接调用 `fileStrategy`、`imageStrategy` 的代码

**引入**：
- `useFileUpload` hook
- 拖拽事件处理（输入框区域）

**新增**：
- 统一的文件/图片 input（两个，和首页一致）
- 拖拽高亮效果（输入框区域）
- 附件预览 chips（显示文件名/图片缩略图，可清除）

**改造后的关键代码**：

```tsx
const { attachments, payload, attachStatus, attachError, handleFiles, clearAttachments, canSend, getSourceType } = useFileUpload();

// 拖拽（仅输入框区域）
const [isDragging, setIsDragging] = useState(false);
const dragCounterRef = useRef(0);

const handleDragEnter = (e: DragEvent) => { /* 同首页逻辑 */ };
const handleDragLeave = (e: DragEvent) => { /* 同首页逻辑 */ };
const handleDragOver = (e: DragEvent) => { e.preventDefault(); };
const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  setIsDragging(false);
  dragCounterRef.current = 0;
  handleFiles(Array.from(e.dataTransfer.files));
};

// 发送
const handleSend = () => {
  if (payload) {
    onSendMessage(payload.content, chartType, getSourceType());
  } else if (prompt.trim()) {
    onSendMessage(prompt.trim(), chartType, 'text');
  }
  clearAttachments();
  setPrompt('');
};

// canSend
const canSendNow = () => {
  if (isGenerating) return false;
  return canSend(!!prompt.trim());
};
```

**UI 变化**：
- 底部操作栏：Paperclip + Image 按钮保持不变
- 附件状态区：textarea 下方显示附件 chips（文件名、状态、清除按钮）
- 拖拽 overlay：输入框区域拖拽时显示虚线边框高亮
- 删除 ImageUpload 视图切换逻辑

### 删除：`components/ImageUpload.tsx`

功能被 AICopilotPanel 的统一处理替代。文件和图片都通过 `handleFiles` 入口处理，附件用统一的 chips 展示。

## 数据流

```
用户操作 (拖拽/点击)
    │
    ▼
files: File[]
    │
    ▼
useFileUpload.handleFiles(files, prompt?)
    │
    ▼
orchestrator.handleFiles(files, prompt, 'auto')
    ├── validateAll → 校验
    ├── processAll  → 并行处理 (FileStrategy / ImageStrategy)
    └── merge       → 合并为 MessagePayload
    │
    ▼
{ attachments, payload, attachStatus, attachError }
    │
    ▼
调用方读取 payload → onSendMessage(payload.content, chartType, sourceType)
```

## 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| **新增** | `composables/useFileUpload.ts` | 核心 hook |
| **改造** | `components/AIPromptBox.tsx` | 删除手动状态，引入 hook |
| **改造** | `components/AICopilotPanel.tsx` | 删除手动状态，引入 hook，添加拖拽，支持多文件 |
| **删除** | `components/ImageUpload.tsx` | 功能被统一处理替代 |
| 不改动 | `lib/input-strategies/*` | 策略和编排器保持不变 |
| 不改动 | `lib/image-utils.ts` | 工具函数保持不变 |
| 不改动 | `app/editor/page.tsx` | `onSendMessage` 接口不变 |
| 不改动 | `app/api/generate/route.ts` | API 不变 |

## 不在范围内

- 粘贴上传支持（当前首页和编辑器都不支持）
- 附件预览图片缩略图（仅显示文件名 chip）
- 拖拽 overlay 的精细动画
