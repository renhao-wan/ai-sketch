# Draw.io 画布迁移实现计划：iframe → @maxgraph/core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 DrawioCanvas 从 iframe（~5MB）替换为 @maxgraph/core 直接渲染（~200KB），提供轻量编辑器，DiagramCanvas 改为按需挂载。

**Architecture:** 用 @maxgraph/core 解析 Draw.io XML 并渲染到 Canvas，通过自定义 DrawioToolbar 和 ContextMenu 提供轻量编辑能力。DiagramCanvas 从始终挂载 + z-index 切换改为条件渲染。

**Tech Stack:** @maxgraph/core, React 19, Next.js 16, TypeScript strict, Tailwind CSS v4, lucide-react

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `package.json` | 修改 | 添加 `@maxgraph/core` 依赖 |
| `hooks/useMxGraph.ts` | 新增 | mxGraph 初始化、XML 解析/渲染、编辑操作 |
| `components/canvases/DrawioToolbar.tsx` | 新增 | 浮动工具栏（图形工具 + 操作按钮） |
| `components/canvases/ContextMenu.tsx` | 新增 | 右键菜单（可复用） |
| `components/canvases/DrawioCanvas.tsx` | 重写 | 整合 useMxGraph + Toolbar + ContextMenu |
| `components/canvases/DiagramCanvas.tsx` | 修改 | 条件渲染替代始终挂载 |
| `lib/locales/zh.ts` | 修改 | 添加 Draw.io 编辑器 i18n 键 |
| `lib/locales/en.ts` | 修改 | 添加 Draw.io 编辑器 i18n 键 |

---

### Task 1: 安装 @maxgraph/core 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加依赖**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm add @maxgraph/core
```

- [ ] **Step 2: 验证安装**

```bash
pnpm list @maxgraph/core
```

Expected: 显示版本号（>=0.17.0）

- [ ] **Step 3: 验证 TypeScript 可导入**

在项目根目录创建临时文件验证：

```bash
node -e "const mg = require('@maxgraph/core'); console.log(Object.keys(mg).slice(0,5))"
```

Expected: 输出包含 `Graph`, `mxCodec` 等类名

- [ ] **Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): 添加 @maxgraph/core 依赖"
```

---

### Task 2: 创建 useMxGraph hook

**Files:**
- Create: `hooks/useMxGraph.ts`

核心 hook，封装 mxGraph 的初始化、XML 解析/渲染、编辑操作、导出功能。

- [ ] **Step 1: 创建 useMxGraph hook 文件**

```typescript
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Graph } from '@maxgraph/core';

export type DrawioTool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow';

interface UseMxGraphOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  code: string;
}

interface UseMxGraphReturn {
  graph: Graph | null;
  error: string | null;
  activeTool: DrawioTool;
  setActiveTool: (tool: DrawioTool) => void;
  deleteSelected: () => void;
  exportXml: () => string;
  hasSelection: boolean;
}

export function useMxGraph({ containerRef, code }: UseMxGraphOptions): UseMxGraphReturn {
  const graphRef = useRef<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DrawioTool>('select');
  const [hasSelection, setHasSelection] = useState(false);
  const codeRef = useRef(code);

  // 保持 codeRef 同步
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // 初始化 mxGraph
  useEffect(() => {
    const container = containerRef.current;
    if (!container || graphRef.current) return;

    let graph: Graph | null = null;

    import('@maxgraph/core').then(({ Graph, mxUtils, mxCodec, mxEvent }) => {
      graph = new Graph(container);

      // 配置编辑能力
      graph.setEnabled(true);
      graph.setCellsSelectable(true);
      graph.setCellsMovable(true);
      graph.setCellsResizable(true);
      graph.setCellEditable(true); // 双击编辑标签
      graph.setConnectable(true); // 允许连线
      graph.setDropEnabled(false);

      // 启用内置缩放/平移
      graph.setPanning(true);
      graph.centerZoom = true;
      // 滚轮缩放
      container.addEventListener('wheel', (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          graph!.zoom(delta);
        }
      }, { passive: false });

      // 监听选中变化
      graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
        const cells = graph!.getSelectionCells();
        setHasSelection(cells.length > 0);
      });

      graphRef.current = graph;

      // 解析初始 XML
      const xml = codeRef.current;
      if (xml) {
        loadXml(graph, xml, mxUtils, mxCodec, setError);
      }
    }).catch((e: Error) => {
      setError('加载 @maxgraph/core 失败: ' + e.message);
    });

    return () => {
      if (graph) {
        graph.destroy();
        graphRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // XML 变化时重新加载
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    import('@maxgraph/core').then(({ mxUtils, mxCodec }) => {
      if (code) {
        loadXml(graph, code, mxUtils, mxCodec, setError);
      } else {
        // 空内容，清空画布
        graph.getModel().clear();
        setError(null);
      }
    });
  }, [code]);

  // 删除选中元素
  const deleteSelected = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const cells = graph.getSelectionCells();
    if (cells.length > 0) {
      graph.removeCells(cells);
    }
  }, []);

  // 导出当前 XML
  const exportXml = useCallback((): string => {
    const graph = graphRef.current;
    if (!graph) return '';

    const { mxCodec, mxUtils } = require('@maxgraph/core');
    const encoder = new mxCodec();
    const node = encoder.encode(graph.getModel());
    return mxUtils.getXml(node);
  }, []);

  // 工具切换
  const handleSetActiveTool = useCallback((tool: DrawioTool) => {
    setActiveTool(tool);
    const graph = graphRef.current;
    if (!graph) return;

    if (tool === 'select') {
      // 恢复默认交互
      graph.setEnabled(true);
      containerRef.current!.style.cursor = 'default';
    } else {
      // 进入绘图模式
      graph.setEnabled(false);
      containerRef.current!.style.cursor = 'crosshair';
    }
  }, [containerRef]);

  return {
    graph: graphRef.current,
    error,
    activeTool,
    setActiveTool: handleSetActiveTool,
    deleteSelected,
    exportXml,
    hasSelection,
  };
}

// 内部辅助函数：解析 XML 并加载到 graph
function loadXml(
  graph: Graph,
  xml: string,
  mxUtils: { parseXml: (xml: string) => Document },
  mxCodec: new (doc: Document) => { decode: (node: Element, model: unknown) => void },
  setError: (msg: string | null) => void,
) {
  try {
    // 处理 mxfile 包装：提取内部 mxGraphModel
    let cleanXml = xml.trim();
    const mxGraphModelMatch = cleanXml.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
    if (mxGraphModelMatch) {
      cleanXml = mxGraphModelMatch[0];
    }

    const doc = mxUtils.parseXml(cleanXml);
    if (!doc || !doc.documentElement) {
      setError('XML 解析失败：无效的 XML 结构');
      return;
    }

    const codec = new mxCodec(doc);
    graph.getModel().beginUpdate();
    try {
      graph.getModel().clear();
      codec.decode(doc.documentElement, graph.getModel());
    } finally {
      graph.getModel().endUpdate();
    }

    // 自动适配视图
    graph.fit();
    graph.center();
    setError(null);
  } catch (e) {
    setError('XML 解析错误: ' + (e as Error).message);
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit hooks/useMxGraph.ts --strict --jsx react-jsx --moduleResolution bundler --esModuleInterop
```

Expected: 无错误（可能有 @maxgraph/core 类型相关的警告，只要不影响编译即可）

- [ ] **Step 3: 提交**

```bash
git add hooks/useMxGraph.ts
git commit -m "feat(drawio): 添加 useMxGraph hook — 封装 mxGraph 初始化和编辑逻辑"
```

---

### Task 3: 创建 DrawioToolbar 浮动工具栏

**Files:**
- Create: `components/canvases/DrawioToolbar.tsx`

毛玻璃风格浮动工具栏，与 ZoomToolbar 风格统一。

- [ ] **Step 1: 创建 DrawioToolbar 组件**

```typescript
'use client';

import { Square, Circle, Diamond, Type, ArrowRight, Trash2, Pencil, MousePointer } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import type { DrawioTool } from '@/hooks/useMxGraph';

interface DrawioToolbarProps {
  activeTool: DrawioTool;
  onToolChange: (tool: DrawioTool) => void;
  onDelete: () => void;
  onEditLabel: () => void;
  hasSelection: boolean;
}

const shapeTools: { tool: DrawioTool; icon: typeof Square; labelKey: string }[] = [
  { tool: 'select', icon: MousePointer, labelKey: 'drawio.tool.select' },
  { tool: 'rectangle', icon: Square, labelKey: 'drawio.tool.rectangle' },
  { tool: 'ellipse', icon: Circle, labelKey: 'drawio.tool.ellipse' },
  { tool: 'diamond', icon: Diamond, labelKey: 'drawio.tool.diamond' },
  { tool: 'text', icon: Type, labelKey: 'drawio.tool.text' },
  { tool: 'arrow', icon: ArrowRight, labelKey: 'drawio.tool.arrow' },
];

export default function DrawioToolbar({
  activeTool,
  onToolChange,
  onDelete,
  onEditLabel,
  hasSelection,
}: DrawioToolbarProps) {
  const { t } = useLocale();

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 bg-[var(--bg-glass)] backdrop-blur-sm rounded-lg border border-[var(--border)] shadow-[var(--shadow-soft)] p-1">
      {/* 图形工具 */}
      {shapeTools.map(({ tool, icon: Icon, labelKey }) => (
        <button
          key={tool}
          onClick={() => onToolChange(tool)}
          className={`p-1.5 rounded transition-colors ${
            activeTool === tool
              ? 'bg-[var(--accent-violet)]/15 text-[var(--accent-violet)]'
              : 'hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
          title={t(labelKey)}
        >
          <Icon size={14} />
        </button>
      ))}

      {/* 分隔线 */}
      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

      {/* 操作按钮 */}
      <button
        onClick={onDelete}
        disabled={!hasSelection}
        className="p-1.5 rounded transition-colors hover:bg-red-500/10 text-[var(--muted)] hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
        title={t('drawio.action.delete')}
      >
        <Trash2 size={14} />
      </button>
      <button
        onClick={onEditLabel}
        disabled={!hasSelection}
        className="p-1.5 rounded transition-colors hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-30 disabled:cursor-not-allowed"
        title={t('drawio.action.editLabel')}
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit components/canvases/DrawioToolbar.tsx --strict --jsx react-jsx --moduleResolution bundler --esModuleInterop
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add components/canvases/DrawioToolbar.tsx
git commit -m "feat(drawio): 添加 DrawioToolbar 浮动工具栏组件"
```

---

### Task 4: 创建 ContextMenu 右键菜单

**Files:**
- Create: `components/canvases/ContextMenu.tsx`

通用右键菜单组件，DrawioCanvas 使用，其他画布未来也可复用。

- [ ] **Step 1: 创建 ContextMenu 组件**

```typescript
'use client';

import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 确保菜单不超出视口
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-[var(--bg-glass)] backdrop-blur-xl rounded-lg border border-[var(--border)] shadow-[var(--shadow-floating)] py-1"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            if (!item.disabled) {
              item.onClick();
              onClose();
            }
          }}
          disabled={item.disabled}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
            item.danger
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/canvases/ContextMenu.tsx
git commit -m "feat(ui): 添加通用 ContextMenu 右键菜单组件"
```

---

### Task 5: 添加 i18n 键

**Files:**
- Modify: `lib/locales/zh.ts`
- Modify: `lib/locales/en.ts`

- [ ] **Step 1: 在 zh.ts 末尾添加 Draw.io 编辑器相关的翻译键**

在 `lib/locales/zh.ts` 的 `drawio.loadError` 系列之后添加：

```typescript
  // Draw.io editor (mxGraph)
  'drawio.tool.select': '选择',
  'drawio.tool.rectangle': '矩形',
  'drawio.tool.ellipse': '椭圆',
  'drawio.tool.diamond': '菱形',
  'drawio.tool.text': '文本',
  'drawio.tool.arrow': '箭头',
  'drawio.action.delete': '删除',
  'drawio.action.editLabel': '编辑标签',
  'drawio.action.addRect': '添加矩形',
  'drawio.action.addText': '添加文本',
  'drawio.action.copy': '复制',
  'drawio.action.paste': '粘贴',
  'drawio.error.loadFailed': '加载 @maxgraph/core 失败',
  'drawio.error.xmlParse': 'XML 解析错误',
```

- [ ] **Step 2: 在 en.ts 对应位置添加英文翻译**

```typescript
  // Draw.io editor (mxGraph)
  'drawio.tool.select': 'Select',
  'drawio.tool.rectangle': 'Rectangle',
  'drawio.tool.ellipse': 'Ellipse',
  'drawio.tool.diamond': 'Diamond',
  'drawio.tool.text': 'Text',
  'drawio.tool.arrow': 'Arrow',
  'drawio.action.delete': 'Delete',
  'drawio.action.editLabel': 'Edit Label',
  'drawio.action.addRect': 'Add Rectangle',
  'drawio.action.addText': 'Add Text',
  'drawio.action.copy': 'Copy',
  'drawio.action.paste': 'Paste',
  'drawio.error.loadFailed': 'Failed to load @maxgraph/core',
  'drawio.error.xmlParse': 'XML parse error',
```

- [ ] **Step 3: 更新 TranslationDict 类型**

检查 `lib/locales/zh.ts` 的 `TranslationDict` 类型定义，确保新的键被包含在内（如果类型是通过 `typeof zh` 推导的则无需手动修改）。

- [ ] **Step 4: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit --strict
```

Expected: 无新增错误

- [ ] **Step 5: 提交**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(i18n): 添加 Draw.io 编辑器相关翻译键"
```

---

### Task 6: 重写 DrawioCanvas 组件

**Files:**
- Rewrite: `components/canvases/DrawioCanvas.tsx`

删除全部 iframe 逻辑，用 useMxGraph + DrawioToolbar + ContextMenu 重写。

- [ ] **Step 1: 重写 DrawioCanvas.tsx**

```typescript
'use client';

import { useRef, useCallback, useState, useMemo } from 'react';
import { useLocale } from '@/lib/locales';
import { useMxGraph, type DrawioTool } from '@/hooks/useMxGraph';
import DrawioToolbar from './DrawioToolbar';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';

interface DrawioCanvasProps {
  code: string;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export default function DrawioCanvas({ code }: DrawioCanvasProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);

  const {
    graph,
    error,
    activeTool,
    setActiveTool,
    deleteSelected,
    exportXml,
    hasSelection,
  } = useMxGraph({ containerRef, code });

  // 工具栏点击画布放置节点
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!graph || activeTool === 'select') return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    import('@maxgraph/core').then(({ mxUtils, mxPoint }) => {
      // 将屏幕坐标转换为图坐标
      const pt = new mxPoint(x, y);
      const scale = graph!.getView().getScale();
      const translate = graph!.getView().getTranslate();
      const graphX = (pt.x / scale) - translate.x;
      const graphY = (pt.y / scale) - translate.y;

      const model = graph!.getModel();
      const parent = graph!.getDefaultParent();

      model.beginUpdate();
      try {
        if (activeTool === 'arrow') {
          // 箭头模式：点击空白不做操作（需要两个节点才能连线）
          return;
        }

        let style = '';
        let w = 120;
        let h = 60;
        let value = '';

        switch (activeTool) {
          case 'rectangle':
            style = 'rounded=1;whiteSpace=wrap;';
            break;
          case 'ellipse':
            style = 'ellipse;whiteSpace=wrap;';
            break;
          case 'diamond':
            style = 'rhombus;whiteSpace=wrap;';
            break;
          case 'text':
            style = 'text;';
            w = 80;
            h = 30;
            value = t('drawio.tool.text');
            break;
        }

        graph!.insertVertex(parent, null, value, graphX, graphY, w, h, style);
      } finally {
        model.endUpdate();
      }

      // 放置后自动回到选择模式
      setActiveTool('select');
    });
  }, [graph, activeTool, setActiveTool, t]);

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!graph) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 判断是否右键点击了元素
    const cell = graph.getCellAt(x, y);

    if (cell) {
      // 右键元素
      setMenuState({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: t('drawio.action.editLabel'),
            onClick: () => graph.startEditingAtCell(cell),
          },
          {
            label: t('drawio.action.copy'),
            onClick: () => {
              const cells = graph.getSelectionCells().length > 0 ? graph.getSelectionCells() : [cell];
              graph.copyCells(cells);
            },
          },
          {
            label: t('drawio.action.delete'),
            danger: true,
            onClick: () => graph.removeCells([cell]),
          },
        ],
      });
    } else {
      // 右键空白
      setMenuState({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: t('drawio.action.addRect'),
            onClick: () => {
              const scale = graph.getView().getScale();
              const translate = graph.getView().getTranslate();
              const gx = (x / scale) - translate.x;
              const gy = (y / scale) - translate.y;
              const parent = graph.getDefaultParent();
              graph.getModel().beginUpdate();
              try {
                graph.insertVertex(parent, null, '', gx, gy, 120, 60, 'rounded=1;whiteSpace=wrap;');
              } finally {
                graph.getModel().endUpdate();
              }
            },
          },
          {
            label: t('drawio.action.addText'),
            onClick: () => {
              const scale = graph.getView().getScale();
              const translate = graph.getView().getTranslate();
              const gx = (x / scale) - translate.x;
              const gy = (y / scale) - translate.y;
              const parent = graph.getDefaultParent();
              graph.getModel().beginUpdate();
              try {
                graph.insertVertex(parent, null, t('drawio.tool.text'), gx, gy, 80, 30, 'text;');
              } finally {
                graph.getModel().endUpdate();
              }
            },
          },
          {
            label: t('drawio.action.paste'),
            onClick: () => {
              graph.pasteCells();
            },
          },
        ],
      });
    }
  }, [graph, t]);

  // 箭头连线：点击源节点 → 点击目标节点
  const arrowSourceRef = useRef<unknown>(null);

  const handleCellClick = useCallback((e: React.MouseEvent) => {
    if (!graph || activeTool !== 'arrow') return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cell = graph.getCellAt(x, y);

    if (!cell) return;

    if (!arrowSourceRef.current) {
      // 第一次点击：记录源节点
      arrowSourceRef.current = cell;
      graph.setSelectionCell(cell);
    } else {
      // 第二次点击：创建连线
      const source = arrowSourceRef.current;
      arrowSourceRef.current = null;

      const parent = graph.getDefaultParent();
      graph.getModel().beginUpdate();
      try {
        graph.insertEdge(parent, null, '', source as any, cell, 'endArrow=block;endFill=1;');
      } finally {
        graph.getModel().endUpdate();
      }
      setActiveTool('select');
    }
  }, [graph, activeTool, setActiveTool]);

  // 合并点击事件
  const handleClick = useCallback((e: React.MouseEvent) => {
    handleCanvasClick(e);
    handleCellClick(e);
  }, [handleCanvasClick, handleCellClick]);

  // 键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
    }
    if (e.key === 'Escape') {
      setActiveTool('select');
      arrowSourceRef.current = null;
    }
  }, [deleteSelected, setActiveTool]);

  // 编辑标签
  const handleEditLabel = useCallback(() => {
    if (!graph) return;
    const cells = graph.getSelectionCells();
    if (cells.length > 0) {
      graph.startEditingAtCell(cells[0]);
    }
  }, [graph]);

  // 错误状态的降级 UI
  if (error) {
    return (
      <div className="w-full h-full canvas-grid-bg flex flex-col items-center justify-center gap-4 p-8">
        <div className="px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/50 max-w-lg">
          <p className="text-xs font-medium text-red-600 mb-1">{t('drawio.renderError')}</p>
          <p className="text-[11px] text-red-500">{error}</p>
        </div>
        {code && (
          <div className="max-w-lg w-full">
            <p className="text-xs text-[var(--muted)] mb-2">XML 源码：</p>
            <pre className="text-[11px] bg-[var(--bg-code)] p-3 rounded-lg overflow-auto max-h-[300px] text-[var(--fg)]">
              {code.slice(0, 2000)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full canvas-grid-bg relative overflow-hidden" onKeyDown={handleKeyDown} tabIndex={0}>
      <DrawioToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onDelete={deleteSelected}
        onEditLabel={handleEditLabel}
        hasSelection={hasSelection}
      />

      {/* mxGraph 渲染容器 */}
      <div
        ref={containerRef}
        className="w-full h-full"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      {/* 右键菜单 */}
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={menuState.items}
          onClose={() => setMenuState(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit --strict 2>&1 | grep -i "DrawioCanvas\|useMxGraph\|DrawioToolbar\|ContextMenu"
```

Expected: 无与这些文件相关的错误

- [ ] **Step 3: 提交**

```bash
git add components/canvases/DrawioCanvas.tsx
git commit -m "feat(drawio): 重写 DrawioCanvas — 使用 @maxgraph/core 替代 iframe"
```

---

### Task 7: 修改 DiagramCanvas 为按需挂载

**Files:**
- Modify: `components/canvases/DiagramCanvas.tsx`

- [ ] **Step 1: 修改 DiagramCanvas.tsx**

将始终挂载 + z-index 切换改为条件渲染：

```typescript
'use client';

import dynamic from 'next/dynamic';
import type { MutableRefObject } from 'react';
import { useLocale } from '@/lib/locales';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { StreamRendererRef } from './ExcalidrawCanvas';

const ExcalidrawCanvas = dynamic(() => import('./ExcalidrawCanvas'), { ssr: false });
const MermaidCanvas = dynamic(() => import('./MermaidCanvas'), { ssr: false });
const DrawioCanvas = dynamic(() => import('./DrawioCanvas'), { ssr: false });

interface DiagramCanvasProps {
  format: DiagramFormat;
  data: unknown;
  isStreaming?: boolean;
  streamBuffer?: string;
  streamVersion?: number;
  streamRendererRef?: MutableRefObject<StreamRendererRef | null>;
}

export default function DiagramCanvas({ format, data, isStreaming, streamRendererRef }: DiagramCanvasProps) {
  const { t } = useLocale();

  // Normalize: extract array from wrapper objects
  let normalized: unknown = data;
  if (data !== null && data !== undefined && typeof data === 'object' && !Array.isArray(data) && 'elements' in (data as Record<string, unknown>)) {
    normalized = (data as Record<string, unknown>).elements;
  }

  const isEmpty = normalized === null || normalized === undefined;

  // 提取各格式的数据
  const excalidrawElements = format === 'excalidraw' && Array.isArray(normalized) ? normalized : [];
  const mermaidCode = format === 'mermaid' && typeof normalized === 'string' ? normalized : '';
  const drawioCode = format === 'drawio' && typeof normalized === 'string' ? normalized : '';

  return (
    <div className="w-full h-full canvas-grid-bg relative">
      {/* 空状态提示 */}
      {isEmpty && !isStreaming && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-[var(--muted)]">{t('canvas.emptyState')}</p>
        </div>
      )}

      {/* 流式加载提示 */}
      {isStreaming && isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="px-5 py-3 rounded-2xl bg-[var(--surface-warm)] backdrop-blur-xl border border-[var(--accent-violet)]/15 shadow-[var(--shadow-floating)] flex items-center gap-3">
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-violet)]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent-violet)] animate-spin" />
            </div>
            <span className="text-sm font-medium text-[var(--fg)]">{t('canvas.generating')}</span>
          </div>
        </div>
      )}

      {/* 按需挂载：只渲染当前格式的 Canvas */}
      <div className="absolute inset-0">
        {format === 'drawio' && <DrawioCanvas code={drawioCode} />}
        {format === 'excalidraw' && (
          <ExcalidrawCanvas
            elements={excalidrawElements}
            isStreaming={isStreaming}
            streamRendererRef={streamRendererRef}
          />
        )}
        {format === 'mermaid' && <MermaidCanvas code={mermaidCode} isStreaming={isStreaming} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit --strict 2>&1 | grep -i "DiagramCanvas"
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add components/canvases/DiagramCanvas.tsx
git commit -m "refactor(canvas): DiagramCanvas 改为按需挂载，移除 z-index 切换"
```

---

### Task 8: 整体验证与清理

**Files:**
- 全项目验证

- [ ] **Step 1: 完整 TypeScript 编译检查**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
npx tsc --noEmit --strict 2>&1 | grep -v "node_modules"
```

Expected: 无新增错误（已有错误不受影响）

- [ ] **Step 2: ESLint 检查**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm lint 2>&1 | tail -20
```

Expected: 无新增 lint 错误

- [ ] **Step 3: 检查不再需要的 imports**

确认 `DrawioCanvas.tsx` 不再导入 `useZoomControls` 和 `ZoomToolbar`。确认 `DiagramCanvas.tsx` 不再有 z-index 相关逻辑。

- [ ] **Step 4: 最终提交（如果有清理改动）**

```bash
git add -A
git commit -m "chore(drawio): 清理 iframe 相关残留代码"
```

---

## 注意事项

1. **@maxgraph/core 版本**：确保 >=0.17.0，旧版本 API 可能不同
2. **mxfile 处理**：Draw.io XML 可能被 `<mxfile>` 标签包裹，`loadXml` 函数已处理提取内部 `<mxGraphModel>`
3. **坐标转换**：工具栏放置节点需要将屏幕坐标转换为图坐标（考虑缩放和偏移）
4. **动态导入**：@maxgraph/core 通过 `import()` 动态加载，避免 SSR 问题
5. **Excalidraw/Mermaid 不受影响**：这两个画布的代码完全不变
