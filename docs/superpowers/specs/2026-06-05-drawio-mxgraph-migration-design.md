# Draw.io 画布迁移：iframe → @maxgraph/core 直接渲染

## 概述

将 DrawioCanvas 从 iframe 加载 `embed.diagrams.net`（~5MB）替换为 @maxgraph/core 直接渲染（~200KB），同时提供轻量编辑器功能。DiagramCanvas 改为按需挂载架构。

## 目标

1. 消除对 `embed.diagrams.net` 的外部依赖，实现离线可用
2. 加载速度从 ~5s 降至 <1s
3. 提供轻量编辑能力（移动/调整大小/编辑标签/添加删除节点和连线）
4. DiagramCanvas 从始终挂载改为按需挂载，减少内存占用

## 非目标

- 不支持 Excalidraw/Mermaid 格式的统一画布
- 不支持撤销重做（undo/redo）
- 不替换 ExcalidrawCanvas 或 MermaidCanvas

## 技术选型

- **渲染库**：`@maxgraph/core`（mxgraph 社区维护 fork，TypeScript 支持好）
- **不使用**：`mxgraph`（旧版，不再维护）、iframe（外部依赖重）

## 架构设计

### 组件结构

```
DiagramCanvas (按需挂载)
└── DrawioCanvas (重写)
    ├── @maxgraph/core 解析 XML → Canvas 渲染
    ├── DrawioToolbar — 浮动工具栏（毛玻璃风格）
    └── ContextMenu — 右键菜单
```

### 数据流

```
AI 生成 XML
→ DrawioStrategy.postProcess() 提取 XML
→ DrawioCanvas 接收 code prop
→ mxUtils.parseXml() 解析
→ mxCodec.decode() 解码到 graph model
→ graph 渲染到 Canvas
→ 用户编辑（移动/添加/删除）
→ graph.getModel() 获取更新后的 XML
→ 导出
```

### DiagramCanvas 按需挂载

从始终挂载三个 Canvas + z-index 切换，改为条件渲染：

```tsx
// 改前：三个始终挂载，z-index 切换
<div style={{ zIndex: zDrawio }}><DrawioCanvas ... /></div>
<div style={{ zIndex: zExcalidraw }}><ExcalidrawCanvas ... /></div>
<div style={{ zIndex: zMermaid }}><MermaidCanvas ... /></div>

// 改后：按需挂载
{format === 'drawio' && <DrawioCanvas code={drawioCode} />}
{format === 'excalidraw' && <ExcalidrawCanvas ... />}
{format === 'mermaid' && <MermaidCanvas ... />}
```

影响：切换格式时之前的 Canvas 会被卸载。Excalidraw 的编辑状态通过 `renderData` 持久化，无状态丢失问题。

## 编辑器功能

### 支持的操作

| 操作 | 方式 | 实现 |
|------|------|------|
| 移动节点 | 鼠标拖拽 | mxGraph 内置 |
| 调整大小 | 拖拽控制点 | mxGraph 内置 |
| 编辑标签 | 双击节点 | mxGraph inline editing |
| 添加节点 | 工具栏按钮 → 点击画布放置 | 自定义 |
| 添加箭头 | 选源节点 → 箭头按钮 → 点目标节点 | 自定义 |
| 删除元素 | 选中 → 删除按钮 或 Delete 键 | 自定义 |
| 右键菜单 | 右键元素或空白区域 | 自定义 |

### 浮动工具栏 (DrawioToolbar)

位置：画布顶部居中，毛玻璃风格（与项目现有 UI 一致）。

```
┌─────────────────────────────────────────────┐
│  [□] [○] [◇] [T] [→]  │  [🗑] [✏️]  │  [编辑中] │
└─────────────────────────────────────────────┘
  图形工具（5个）        操作工具       状态指示
```

图形工具：矩形、椭圆、菱形、文本、箭头

### 交互流程

1. 点击图形按钮 → 按钮高亮 → 鼠标变十字 → 点击画布放置 → 自动回到选择模式
2. 点击箭头按钮 → 选中源节点 → 点击目标节点 → 创建连线 → 回到选择模式
3. 选中元素后 → 删除/编辑标签按钮激活
4. 点击空白或 Esc → 取消当前操作

### 右键菜单

- 右键空白：添加矩形 / 添加文本 / 粘贴
- 右键元素：编辑标签 / 删除 / 复制

## 错误处理

- **XML 解析失败**：显示错误提示 + 降级显示 XML 源码 + 复制按钮
- **空状态**：显示空画布 + 工具栏（支持从零绘制）
- **大型图表**：mxGraph 原生支持，无额外优化需求

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 添加 `@maxgraph/core` 依赖 |
| `components/canvases/DrawioCanvas.tsx` | 重写 | 删除 iframe，用 @maxgraph/core 渲染 + 编辑器 |
| `components/canvases/DrawioToolbar.tsx` | 新增 | 浮动工具栏组件 |
| `components/canvases/DiagramCanvas.tsx` | 修改 | 改为按需挂载 |
| `components/canvases/ContextMenu.tsx` | 新增 | 右键菜单组件（可复用） |
| `hooks/useMxGraph.ts` | 新增 | mxGraph 初始化和编辑逻辑 hook |

## 缩放/平移方案

mxGraph 内置 Canvas 级别的缩放/平移，比现有 `useZoomControls`（CSS transform）更流畅。DrawioCanvas 不再使用 `useZoomControls` 和 `ZoomToolbar`，改用 mxGraph 内置的：
- `graph.view.setScale()` — 缩放
- 鼠标拖拽平移 — mxGraph 内置
- 滚轮缩放 — mxGraph 内置 `scrollWheelZoom`

`useZoomControls` hook 保留给 ExcalidrawCanvas 和 MermaidCanvas 继续使用。

## 不改动的文件

- `lib/strategies/drawio-strategy.ts` — 策略层不变，仍然输出 XML
- `lib/prompts/drawio/` — 提示词不变
- ExcalidrawCanvas / MermaidCanvas — 不受影响
