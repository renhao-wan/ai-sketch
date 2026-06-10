# 图表版本历史 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Sketch 添加图表版本历史功能，通过右侧抽屉面板展示所有生成版本的缩略图，支持快速切换到任意版本。

**Architecture:** 从现有 messages 表中提取 assistant 消息作为版本列表（零数据库改动），新建 VersionHistoryDrawer 右侧抽屉面板组件，扩展 useGeneration hook 添加 onGenerationComplete 回调以截取 canvas 缩略图，缩略图使用内存缓存 + localStorage 持久化。

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, lucide-react (Clock icon), localStorage

---

### Task 1: 添加翻译键

**Files:**
- Modify: `lib/locales/zh.ts:535` (在 `shortcuts.windowClose` 之后插入)
- Modify: `lib/locales/en.ts` (对应位置)

- [ ] **Step 1: 在 zh.ts 中添加 versionHistory 翻译键**

在 `lib/locales/zh.ts` 的 `'shortcuts.windowClose': '关闭窗口',` 之后、`window.minimize` 之前插入：

```typescript
  // 版本历史
  'versionHistory.title': '版本历史',
  'versionHistory.version': '版本',
  'versionHistory.current': '当前',
  'versionHistory.noThumbnail': '点击加载',
  'versionHistory.empty': '暂无版本',
  'versionHistory.emptyDesc': '生成图表后将在此显示历史',
```

- [ ] **Step 2: 在 zh.ts 中添加快捷键翻译键**

在 `shortcuts` 区域（`'shortcuts.windowClose': '关闭窗口',` 之前）插入：

```typescript
  'shortcuts.openVersionHistory': '版本历史',
```

- [ ] **Step 3: 在 en.ts 中添加对应的英文翻译键**

在 en.ts 的对应位置插入：

```typescript
  // Version History
  'versionHistory.title': 'Version History',
  'versionHistory.version': 'Version',
  'versionHistory.current': 'Current',
  'versionHistory.noThumbnail': 'Click to load',
  'versionHistory.empty': 'No versions yet',
  'versionHistory.emptyDesc': 'Version history will appear here after generating diagrams',
```

以及快捷键：

```typescript
  'shortcuts.openVersionHistory': 'Version History',
```

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(i18n): 添加版本历史翻译键"
```

---

### Task 2: 扩展 useGeneration hook — 添加 onGenerationComplete 回调

**Files:**
- Modify: `hooks/useGeneration.ts:13-25` (接口定义)
- Modify: `hooks/useGeneration.ts:233-238` (回调调用位置)

- [ ] **Step 1: 在 UseGenerationOptions 接口中添加 onGenerationComplete**

在 `hooks/useGeneration.ts` 的 `UseGenerationOptions` 接口中，`onChartTypeUpdate` 之后添加：

```typescript
  onGenerationComplete?: (messageId: string, code: string) => void;
```

完整接口变为：

```typescript
interface UseGenerationOptions {
  config: LLMConfig | null;
  format: DiagramFormat;
  conversationId: string | null;
  streamRendererRef: React.MutableRefObject<StreamRendererRef | null>;
  onCodeUpdate: (code: string) => void;
  onRenderDataUpdate: (data: unknown) => void;
  onJsonErrorUpdate: (error: string | null) => void;
  onConversationIdUpdate: (id: string | null) => void;
  onMessagesUpdate: (updater: (prev: ConversationMessage[]) => ConversationMessage[]) => void;
  onConfigReminder: () => void;
  onChartTypeUpdate?: (chartType: string) => void;
  onGenerationComplete?: (messageId: string, code: string) => void;
}
```

- [ ] **Step 2: 在 executeGeneration 中调用 onGenerationComplete**

在 `hooks/useGeneration.ts` 的 `executeGeneration` 函数中，找到消息更新代码块（第 234-238 行）：

```typescript
      // 更新消息
      options.onMessagesUpdate(prev => prev.map(m =>
        m.id === optimisticAssistantMsg.id
          ? { ...m, content: optimizedCode, conversationId: activeConvId || m.conversationId }
          : m
      ));
```

在其后、`catch` 之前插入：

```typescript
      // 通知生成完成（用于缩略图截取等）
      options.onGenerationComplete?.(optimisticAssistantMsg.id, optimizedCode);
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch && npx tsc --noEmit
```

Expected: 无错误（新增的是可选回调，现有调用方不受影响）

- [ ] **Step 4: 提交**

```bash
git add hooks/useGeneration.ts
git commit -m "feat(hooks): useGeneration 新增 onGenerationComplete 回调"
```

---

### Task 3: 新建 VersionThumbnail 组件

**Files:**
- Create: `components/version-history/VersionThumbnail.tsx`

- [ ] **Step 1: 创建 VersionThumbnail 组件**

```typescript
'use client';

import { useLocale } from '@/lib/locales';

interface VersionThumbnailProps {
  thumbnail: string | undefined;
  versionNumber: number;
}

export default function VersionThumbnail({ thumbnail, versionNumber }: VersionThumbnailProps) {
  const { t } = useLocale();

  if (thumbnail) {
    return (
      <div className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-[var(--surface)] border border-[var(--border)]">
        <img
          src={thumbnail}
          alt={`${t('versionHistory.version')} ${versionNumber}`}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="w-full aspect-[16/10] rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
      <span className="text-xs text-[var(--muted)]">{t('versionHistory.noThumbnail')}</span>
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add components/version-history/VersionThumbnail.tsx
git commit -m "feat(ui): 新建 VersionThumbnail 缩略图组件"
```

---

### Task 4: 新建 VersionCard 组件

**Files:**
- Create: `components/version-history/VersionCard.tsx`
- Deps: `components/version-history/VersionThumbnail.tsx` (Task 3)

- [ ] **Step 1: 创建 VersionCard 组件**

```typescript
'use client';

import { useLocale } from '@/lib/locales';
import VersionThumbnail from './VersionThumbnail';

interface VersionCardProps {
  id: string;
  versionNumber: number;
  createdAt: number;
  isCurrent: boolean;
  thumbnail: string | undefined;
  onSelect: (id: string) => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function VersionCard({ id, versionNumber, createdAt, isCurrent, thumbnail, onSelect }: VersionCardProps) {
  const { t } = useLocale();

  return (
    <button
      onClick={() => onSelect(id)}
      className={`w-full text-left rounded-xl p-3 transition-all duration-200 cursor-pointer group
        ${isCurrent
          ? 'bg-[var(--accent-indigo)]/10 border-2 border-[var(--accent-indigo)]/40'
          : 'bg-[var(--surface-elevated)]/50 border-2 border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-elevated)]'
        }`}
    >
      {/* 版本标题 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--text)]">
          {t('versionHistory.version')} {versionNumber}
          <span className="text-xs text-[var(--muted)] ml-2">{formatTime(createdAt)}</span>
        </span>
        {isCurrent && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-indigo)]/20 text-[var(--accent-indigo)]">
            {t('versionHistory.current')}
          </span>
        )}
      </div>

      {/* 缩略图 */}
      <VersionThumbnail thumbnail={thumbnail} versionNumber={versionNumber} />
    </button>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add components/version-history/VersionCard.tsx
git commit -m "feat(ui): 新建 VersionCard 版本卡片组件"
```

---

### Task 5: 新建 VersionHistoryDrawer 组件

**Files:**
- Create: `components/version-history/VersionHistoryDrawer.tsx`
- Deps: `components/version-history/VersionCard.tsx` (Task 4)

- [ ] **Step 1: 创建 VersionHistoryDrawer 组件**

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { X, Clock } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import VersionCard from './VersionCard';

export interface VersionItem {
  id: string;
  versionNumber: number;
  createdAt: number;
}

interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  versions: VersionItem[];
  currentVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  thumbnails: Map<string, string>;
}

export default function VersionHistoryDrawer({
  open,
  onClose,
  versions,
  currentVersionId,
  onSelectVersion,
  thumbnails,
}: VersionHistoryDrawerProps) {
  const { t } = useLocale();
  const drawerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 抽屉面板 */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-[360px] bg-[var(--bg)] border-l border-[var(--border)] shadow-2xl z-50
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[var(--accent-indigo)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">{t('versionHistory.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 版本列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ height: 'calc(100% - 56px)' }}>
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Clock size={48} className="text-[var(--muted)] opacity-30 mb-4" />
              <p className="text-sm font-medium text-[var(--muted)]">{t('versionHistory.empty')}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{t('versionHistory.emptyDesc')}</p>
            </div>
          ) : (
            versions.map((version) => (
              <VersionCard
                key={version.id}
                id={version.id}
                versionNumber={version.versionNumber}
                createdAt={version.createdAt}
                isCurrent={version.id === currentVersionId}
                thumbnail={thumbnails.get(version.id)}
                onSelect={onSelectVersion}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add components/version-history/VersionHistoryDrawer.tsx
git commit -m "feat(ui): 新建 VersionHistoryDrawer 抽屉面板组件"
```

---

### Task 6: 在编辑器页面集成版本历史

**Files:**
- Modify: `app/editor/page.tsx:1-4` (imports)
- Modify: `app/editor/page.tsx:86-94` (新增 state)
- Modify: `app/editor/page.tsx:144-159` (useGeneration 调用)
- Modify: `app/editor/page.tsx:258-263` (useShortcuts 调用)
- Modify: `app/editor/page.tsx:344-418` (JSX)

- [ ] **Step 1: 添加 VersionHistoryDrawer 的动态导入**

在 `app/editor/page.tsx` 的动态导入区域（第 29-30 行之后）添加：

```typescript
const VersionHistoryDrawer = dynamic(() => import('@/components/version-history/VersionHistoryDrawer'), { ssr: false });
```

- [ ] **Step 2: 添加版本历史相关状态**

在 `app/editor/page.tsx` 的独立状态区域（第 92 行 `const [panelWidth, setPanelWidth] = useState(360);` 之后）添加：

```typescript
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [versionThumbnails, setVersionThumbnails] = useState<Map<string, string>>(new Map());
```

- [ ] **Step 3: 添加版本列表计算**

在状态声明之后、`useEffect` 之前添加：

```typescript
  // 版本列表：从 messages 中提取 assistant 消息
  const versions = useMemo(() =>
    conversation.messages
      .filter(msg => msg.role === 'assistant')
      .map((msg, index) => ({
        id: msg.id,
        versionNumber: index + 1,
        createdAt: msg.createdAt,
      })),
    [conversation.messages]
  );
```

注意：需要在文件顶部的 import 中添加 `useMemo`（检查是否已存在于第 3 行的 import 中）。

- [ ] **Step 4: 添加缩略图恢复 effect**

在版本列表计算之后添加：

```typescript
  // 从 localStorage 恢复历史缩略图
  useEffect(() => {
    const assistantMessages = conversation.messages.filter(msg => msg.role === 'assistant');
    const restored = new Map<string, string>();
    for (const msg of assistantMessages) {
      const cached = localStorage.getItem(`version_thumb_${msg.id}`);
      if (cached) restored.set(msg.id, cached);
    }
    if (restored.size > 0) {
      setVersionThumbnails(prev => new Map([...prev, ...restored]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.messages]);
```

- [ ] **Step 5: 添加版本切换和抽屉关闭回调**

在 `handleShowDiagram` 之后添加：

```typescript
  const handleSelectVersion = useCallback((versionId: string) => {
    const msg = conversation.messages.find(m => m.id === versionId);
    if (!msg) return;
    handleShowDiagram(msg.content);
    setCurrentVersionId(versionId);
  }, [conversation.messages, handleShowDiagram]);

  const handleCloseVersionDrawer = useCallback(() => {
    setVersionDrawerOpen(false);
  }, []);
```

- [ ] **Step 6: 在 useGeneration 调用中添加 onGenerationComplete 回调**

在 `app/editor/page.tsx` 的 `useGeneration` 调用中，`onChartTypeUpdate: setCurrentChartType,` 之后添加：

```typescript
    onGenerationComplete: (messageId: string) => {
      requestAnimationFrame(() => {
        const canvas = document.querySelector('.excalidraw canvas') as HTMLCanvasElement;
        if (canvas) {
          const thumbnail = canvas.toDataURL('image/png', 0.5);
          setVersionThumbnails(prev => new Map(prev).set(messageId, thumbnail));
          try {
            localStorage.setItem(`version_thumb_${messageId}`, thumbnail);
          } catch {
            // localStorage 满了，忽略
          }
        }
      });
    },
```

- [ ] **Step 7: 在 useShortcuts 调用中添加版本历史快捷键**

在 `app/editor/page.tsx` 的 `useShortcuts` 调用中添加 `onOpenVersionHistory` 回调：

```typescript
  useShortcuts({
    onGoHome: () => router.push('/'),
    onNewConversation: conversation.newConversation,
    onOpenSettings: (tab) => router.push(tab ? `/settings?tab=${tab}` : '/settings'),
    onSwitchFormat: (f) => { setFormat(f); dispatchGenResult({ type: 'CLEAR' }); },
    onOpenVersionHistory: () => setVersionDrawerOpen(prev => !prev),
  });
```

- [ ] **Step 8: 在 FloatingAIActions 旁添加 History 按钮**

在 `app/editor/page.tsx` 的 JSX 中，找到 FloatingAIActions 组件（第 380-384 行），在其下方添加版本历史按钮：

```tsx
          {/* Version History Trigger */}
          <button
            onClick={() => setVersionDrawerOpen(prev => !prev)}
            className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-[var(--surface-elevated)]/80 backdrop-blur-sm border border-[var(--border)] hover:bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--text)] transition-all shadow-lg"
            title={t('versionHistory.title')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
```

- [ ] **Step 9: 在 JSX 末尾添加 VersionHistoryDrawer**

在 `app/editor/page.tsx` 的 `</>` 闭合之前（ConfigSelector 之后）添加：

```tsx
      <VersionHistoryDrawer
        open={versionDrawerOpen}
        onClose={handleCloseVersionDrawer}
        versions={versions}
        currentVersionId={currentVersionId}
        onSelectVersion={handleSelectVersion}
        thumbnails={versionThumbnails}
      />
```

- [ ] **Step 10: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 11: 提交**

```bash
git add app/editor/page.tsx
git commit -m "feat(editor): 集成版本历史面板和缩略图截取"
```

---

### Task 7: 在 useShortcuts 中注册 Alt+H 快捷键

**Files:**
- Modify: `hooks/useShortcuts.ts:30-37` (shortcuts 数组)
- Modify: `hooks/useShortcuts.ts:66-69` (UseShortcutsOptions 接口)
- Modify: `hooks/useShortcuts.ts:167-172` (handleKeyDown 中的 handler)
- Modify: `components/settings/KeyboardShortcutsSettings.tsx:25` (shortcutIds)

- [ ] **Step 1: 在 shortcuts 数组中添加 open-version-history**

在 `hooks/useShortcuts.ts` 的 shortcuts 数组中，`open-storage` 条目之后添加：

```typescript
  {
    id: 'open-version-history',
    keys: ['Alt', 'H'],
    description: '版本历史',
    descriptionKey: 'shortcuts.openVersionHistory',
    scope: 'global',
  },
```

- [ ] **Step 2: 在 UseShortcutsOptions 接口中添加回调**

在 `hooks/useShortcuts.ts` 的 `UseShortcutsOptions` 接口中，`onOpenStorage?: () => void;` 之后添加：

```typescript
  onOpenVersionHistory?: () => void;
```

- [ ] **Step 3: 在 handleKeyDown 中添加处理逻辑**

在 `hooks/useShortcuts.ts` 的 `handleKeyDown` 函数中，`open-storage` 的 case 之后添加：

```typescript
      case 'open-version-history':
        options.onOpenVersionHistory?.();
        break;
```

- [ ] **Step 4: 在 KeyboardShortcutsSettings 中注册**

在 `components/settings/KeyboardShortcutsSettings.tsx` 的 settings 类别的 `shortcutIds` 数组中，`'open-storage'` 之后添加 `'open-version-history'`：

```typescript
shortcutIds: ['open-settings', 'open-appearance', 'open-llm', 'open-conversations', 'open-tags', 'open-storage', 'open-version-history', 'open-shortcuts', 'open-network', 'open-about'],
```

- [ ] **Step 5: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add hooks/useShortcuts.ts components/settings/KeyboardShortcutsSettings.tsx
git commit -m "feat(shortcuts): 注册 Alt+H 版本历史快捷键"
```

---

### Task 8: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch && pnpm dev
```

- [ ] **Step 2: 手动测试流程**

1. 打开编辑器页面
2. 配置 LLM 并生成一张图表
3. 验证画布右上角出现时钟图标按钮
4. 点击时钟图标，验证右侧抽屉滑出
5. 验证版本列表显示"版本 1"和缩略图
6. 修改 prompt 生成第二张图表
7. 验证版本列表更新为"版本 1"和"版本 2"
8. 点击"版本 1"，验证画布切换回第一个版本
9. 验证"当前"标记正确显示
10. 按 Alt+H，验证抽屉打开/关闭
11. 按 ESC，验证抽屉关闭
12. 刷新页面，验证缩略图从 localStorage 恢复

- [ ] **Step 3: 最终提交（如有修复）**

```bash
git add -A
git commit -m "fix(version-history): 端到端测试修复"
```