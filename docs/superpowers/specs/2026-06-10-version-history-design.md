# 图表版本历史 — 设计文档

**日期**：2026-06-10
**状态**：已批准
**工作量**：2-3 天（标准版）

---

## 一、概述

为 AI Sketch 添加图表版本历史功能，让用户在对话中生成多个版本时，可以通过右侧抽屉面板查看所有版本的缩略图、快速切换到任意版本。

### 核心价值

- 用户经常需要对比不同版本的图表，或回退到之前的效果
- 当前只能通过翻聊天记录逐条点击 Play 按钮，体验差
- 没有版本概览，不知道这个对话一共生成了几个版本

### 设计原则

- **零数据库改动**：从现有 messages 表中提取版本列表
- **复用已有逻辑**：版本切换复用 `handleShowDiagram` 函数
- **最小侵入**：不修改画布组件、不修改消息气泡组件

---

## 二、数据层

### 2.1 版本提取

版本列表从 `messages` 表中提取所有 `role = 'assistant'` 的消息，按 `created_at ASC` 排序。每个 assistant 消息的 `content` 字段即为该版本的完整图表代码。

```typescript
// 从已有 messages 中提取版本列表
const versions = messages
  .filter(msg => msg.role === 'assistant')
  .map((msg, index) => ({
    id: msg.id,
    versionNumber: index + 1,
    createdAt: msg.createdAt,
    code: msg.content,
  }));
```

### 2.2 缩略图存储

使用 **内存缓存 + localStorage 持久化**，不修改数据库：

```typescript
// 内存缓存
const thumbnailCache = new Map<string, string>();

// 生成时存储
thumbnailCache.set(messageId, base64Png);
localStorage.setItem(`version_thumb_${messageId}`, base64Png);

// 加载时恢复
const cached = localStorage.getItem(`version_thumb_${messageId}`);
if (cached) thumbnailCache.set(messageId, cached);
```

**localStorage 容量考虑**：每个缩略图约 50-100KB（PNG），localStorage 通常有 5-10MB 限制，可存储约 50-100 个版本缩略图。超出时跳过存储，不报错。

### 2.3 Regenerate 行为

保持现有行为：regenerate 时删除上一条 assistant 消息。版本列表中该版本会消失。被 regenerate 覆盖的版本不会保留在历史中。

---

## 三、UI 组件

### 3.1 VersionHistoryDrawer

**路径**：`components/version-history/VersionHistoryDrawer.tsx`

右侧抽屉面板，固定宽度 360px，从右侧滑入。

```
┌──────────────────────────────────┐
│  版本历史                    ✕   │
├──────────────────────────────────┤
│                                  │
│  ┌────────────────────────────┐  │
│  │  版本 1 · 14:32            │  │
│  │  ┌──────────────────────┐  │  │
│  │  │     [缩略图/占位符]   │  │  │
│  │  │                      │  │  │
│  │  └──────────────────────┘  │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  版本 2 · 14:35     [当前] │  │
│  │  ┌──────────────────────┐  │  │
│  │  │     [缩略图]          │  │  │
│  │  │                      │  │  │
│  │  └──────────────────────┘  │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  版本 3 · 14:40            │  │
│  │  ┌──────────────────────┐  │  │
│  │  │     [点击加载]        │  │  │
│  │  │                      │  │  │
│  │  └──────────────────────┘  │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

**Props**：

```typescript
interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  versions: VersionItem[];
  currentVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  thumbnails: Map<string, string>;
}

interface VersionItem {
  id: string;
  versionNumber: number;
  createdAt: number;
}
```

**交互**：

- 点击版本卡片 → 调用 `onSelectVersion`，切换画布到该版本
- 当前版本高亮显示（边框或背景色区分）
- 无缩略图的版本显示占位符（灰色背景 + "点击加载"文字）
- 抽屉打开/关闭有滑入/滑出动画（200ms ease）

### 3.2 触发入口

在编辑器页面右上角工具栏添加 History 图标按钮（Clock 来自 lucide-react），位于现有工具按钮旁边。

按钮状态：
- 默认：普通样式
- 有新版本时：可选显示小红点（低优先级，后续迭代）

### 3.3 空状态

当对话中没有 assistant 消息时（新对话、尚未生成），显示空状态：

```
┌──────────────────────────────────┐
│  版本历史                    ✕   │
├──────────────────────────────────┤
│                                  │
│         暂无版本                  │
│    生成图表后将在此显示历史        │
│                                  │
└──────────────────────────────────┘
```

---

## 四、状态管理

在 `app/editor/page.tsx` 中新增状态：

```typescript
// 版本历史面板
const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
const [versionThumbnails, setVersionThumbnails] = useState<Map<string, string>>(new Map());
```

### 4.1 版本列表计算

从已有 messages 中派生，不需要额外状态：

```typescript
const versions = useMemo(() =>
  messages
    .filter(msg => msg.role === 'assistant')
    .map((msg, index) => ({
      id: msg.id,
      versionNumber: index + 1,
      createdAt: msg.createdAt,
    })),
  [messages]
);
```

### 4.2 版本切换

复用已有 `handleShowDiagram` 函数：

```typescript
const handleSelectVersion = useCallback((versionId: string) => {
  const version = versions.find(v => v.id === versionId);
  if (!version) return;
  const msg = messages.find(m => m.id === versionId);
  if (!msg) return;
  handleShowDiagram(msg.content);
  setCurrentVersionId(versionId);
}, [versions, messages, handleShowDiagram]);
```

### 4.3 缩略图生成

当前 `useGeneration` hook 没有 onComplete 回调。需要扩展 `UseGenerationOptions` 接口，新增 `onGenerationComplete` 回调：

```typescript
// hooks/useGeneration.ts — 新增回调
interface UseGenerationOptions {
  // ... 现有回调
  onGenerationComplete?: (messageId: string, code: string) => void;
}
```

在 `executeGeneration` 函数中，`consumeStream` 之后、`catch` 之前调用：

```typescript
// hooks/useGeneration.ts — executeGeneration 内部
// ... 后处理完成后
options.onGenerationComplete?.(optimisticAssistantMsg.id, optimizedCode);
```

在 `editor/page.tsx` 中实现缩略图截取：

```typescript
// app/editor/page.tsx — useGeneration 调用处
const generation = useGeneration({
  // ... 现有回调
  onGenerationComplete: useCallback((messageId: string) => {
    // 延迟一帧确保画布已渲染完成
    requestAnimationFrame(() => {
      const canvas = document.querySelector('.excalidraw canvas') as HTMLCanvasElement;
      if (canvas) {
        const thumbnail = canvas.toDataURL('image/png', 0.5); // 50% 质量
        setVersionThumbnails(prev => new Map(prev).set(messageId, thumbnail));
        try {
          localStorage.setItem(`version_thumb_${messageId}`, thumbnail);
        } catch {
          // localStorage 满了，忽略
        }
      }
    });
  }, []),
});
```
```

### 4.4 加载历史缩略图

打开对话时从 localStorage 恢复：

```typescript
useEffect(() => {
  const assistantMessages = messages.filter(msg => msg.role === 'assistant');
  const restored = new Map<string, string>();
  for (const msg of assistantMessages) {
    const cached = localStorage.getItem(`version_thumb_${msg.id}`);
    if (cached) restored.set(msg.id, cached);
  }
  if (restored.size > 0) {
    setVersionThumbnails(prev => new Map([...prev, ...restored]));
  }
}, [messages]);
```

---

## 五、快捷键

新增 `Alt+H` 打开/关闭版本历史面板：

```typescript
// hooks/useShortcuts.ts 中新增
{
  id: 'open-version-history',
  keys: ['Alt', 'H'],
  description: '版本历史',
  descriptionKey: 'shortcuts.openVersionHistory',
  scope: 'global',
}
```

在 `KeyboardShortcutsSettings.tsx` 的 settings 类别中注册。

---

## 六、翻译

### 中文（zh.ts）

```typescript
versionHistory: {
  title: '版本历史',
  version: '版本',
  current: '当前',
  noThumbnail: '点击加载',
  empty: '暂无版本',
  emptyDesc: '生成图表后将在此显示历史',
},
shortcuts: {
  openVersionHistory: '版本历史',
}
```

### 英文（en.ts）

```typescript
versionHistory: {
  title: 'Version History',
  version: 'Version',
  current: 'Current',
  noThumbnail: 'Click to load',
  empty: 'No versions yet',
  emptyDesc: 'Version history will appear here after generating diagrams',
},
shortcuts: {
  openVersionHistory: 'Version History',
}
```

---

## 七、文件清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 新建 | `components/version-history/VersionHistoryDrawer.tsx` | 版本历史抽屉面板组件 |
| 新建 | `components/version-history/VersionCard.tsx` | 单个版本卡片组件 |
| 新建 | `components/version-history/VersionThumbnail.tsx` | 缩略图组件（含占位符） |
| 修改 | `hooks/useGeneration.ts` | 新增 `onGenerationComplete` 回调 |
| 修改 | `app/editor/page.tsx` | 新增版本历史状态、触发入口、缩略图截取、快捷键 |
| 修改 | `hooks/useShortcuts.ts` | 新增 Alt+H 快捷键 |
| 修改 | `components/settings/KeyboardShortcutsSettings.tsx` | 注册快捷键 |
| 修改 | `lib/locales/zh.ts` | 新增翻译键 |
| 修改 | `lib/locales/en.ts` | 新增翻译键 |

---

## 八、不做的事（YAGNI）

- ❌ 不新建数据库表或修改 schema
- ❌ 不修改 regenerate 行为（保持删除旧消息）
- ❌ 不修改 ExcalidrawCanvas / DiagramCanvas 组件
- ❌ 不修改 MessageBubble 组件
- ❌ 不添加版本标签/备注功能
- ❌ 不添加版本 diff 对比
- ❌ 不自动为历史消息生成缩略图（只在生成时截取）

---

## 九、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| localStorage 容量不足 | 缩略图无法持久化 | 容量满时静默跳过，不影响功能 |
| canvas.toDataURL() 跨域问题 | 截图失败 | Excalidraw 使用本地渲染，无跨域问题 |
| 大量版本时列表滚动性能 | 列表卡顿 | 使用虚拟滚动或限制显示最近 50 个版本 |
| 版本切换时画布闪烁 | 体验差 | handleShowDiagram 已有优化，风险低 |