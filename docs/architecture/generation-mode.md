# 生成模式（Generation Mode）

AI Sketch 支持三种生成模式，控制 LLM 生成图表代码的策略。用户通过编辑器输入框旁的切换按钮选择模式。

## 模式说明

| 模式 | 图标 | 说明 |
|------|------|------|
| 快速 | ⚡ | 单步生成，一次 LLM 调用，直接输出代码 |
| 自动 | 🤖 | 服务端评估复杂度，自动选择快速或高质量 |
| 高质量 | 🎯 | 多轮生成 + 规则校验 + LLM 评审 + 修复循环 |

默认模式为**自动**。

## 自动模式的判断逻辑

自动模式根据**图表格式**和**用户输入的复杂度评分**决定走快速还是高质量。

```
用户输入
  ↓
格式是 Mermaid？
  ├── 是 → 快速（Mermaid 布局由渲染器处理，多轮收益低）
  └── 否 → 计算复杂度评分
              ├── 评分 < 12 → 快速
              └── 评分 ≥ 12 → 高质量
```

### 评分规则

| 指标 | 条件 | 分值 |
|------|------|------|
| 数量指标 | 描述中最大数字 ≥ 20 | +6 |
| 数量指标 | 描述中最大数字 ≥ 10 | +4 |
| 数量指标 | 描述中最大数字 ≥ 5 | +2 |
| 关系密度 | 每个连接词（连接/依赖/调用/关联/交互/通信） | +1 |
| 结构复杂度 | 每个关键词（架构/微服务/分层/组件/模块等） | +2 |
| 分区/分组 | 每个分组词（分为/包括/包含等） | +2 |

阈值为 12 分，意味着至少需要 10+ 实体 + 1-2 个复杂度关键词才会触发高质量模式。

**实现**：`lib/generation/complexity-assessor.ts`

## 高质量模式的执行流程

```
Planner（1 次 LLM 调用）
  → 输出结构化生成计划（步骤列表 + 依赖关系）
  ↓
Multi-pass Generator（按步骤执行，每步 1 次 LLM 调用）
  → Step 1: 生成节点
  → Step 2: 添加连线
  → Step 3: 样式优化
  ↓
Critic 规则校验（不消耗 token）
  → 检查 JSON/XML 语法、元素重叠、连线断开、边界越界等
  ↓
  ├── 通过 → 输出最终代码
  └── 失败 → LLM 评审 + 修复（1 次 LLM 调用）
              → 重新校验 → 输出修复后的代码（或当前最佳结果）
```

### Planner 输出格式

Planner 调用 LLM 输出结构化 JSON 计划：

```json
{
  "complexity": "complex",
  "estimatedNodes": 20,
  "steps": [
    {
      "type": "nodes",
      "description": "生成所有服务节点：用户服务、订单服务、...",
      "dependencies": []
    },
    {
      "type": "connections",
      "description": "添加服务间的调用关系",
      "dependencies": [0]
    },
    {
      "type": "style",
      "description": "统一配色、调整布局",
      "dependencies": [1]
    }
  ]
}
```

步骤类型：
- `nodes`：生成一组节点/形状
- `connections`：添加连线/箭头
- `style`：样式优化、布局调整

**实现**：`lib/generation/planner.ts`

### 代码合并策略

多轮生成中，每步的输出需要合并到累积代码。不同格式使用不同的合并策略：

| 格式 | 合并方式 |
|------|----------|
| Excalidraw | JSON 数组合并（`[...existing, ...incoming]`） |
| Mermaid | 代码行追加（跳过重复的声明行） |
| Draw.io | 提取 `<mxCell>` 标签，插入到 `</root>` 之前 |

**实现**：`lib/generation/multi-pass-generator.ts`

### 规则校验

不消耗 token 的结构性检查：

| 格式 | 校验规则 |
|------|----------|
| Excalidraw | JSON 解析、元素列表非空、连线断开检测、边界越界检测 |
| Mermaid | 图表类型声明、方向声明（TD/TB/RL/LR） |
| Draw.io | XML 结构（mxfile/mxGraphModel）、mxCell 标签闭合 |

校验结果分为 `error`（阻断，触发修复）和 `warning`（提示，不阻断）。

**实现**：`lib/generation/critic.ts`

### 修复循环

规则校验发现 error 时，调用 LLM 评审并修复：

1. 将当前代码 + 校验问题列表发送给 LLM
2. LLM 返回修复后的代码
3. 重新校验修复后的代码
4. 如果仍失败，重试（最多 `maxRetries` 次）
5. 最终仍失败则输出当前最佳结果（不阻断）

## 前端交互

### 模式切换组件

`components/ai/GenerationModeToggle.tsx`

- 单按钮 + 下拉菜单形式，占位小
- 按钮图标显示当前模式（⚡/🤖/🎯）
- 非自动模式时按钮有 indigo 高亮
- 位于输入框底部操作栏，发送按钮左侧

### SSE 事件

高质量模式新增两种 SSE 事件类型：

```typescript
// 进度事件
{ type: 'progress', step: number, totalSteps: number, message: string }

// 校验事件
{ type: 'critique', passed: boolean, issues: string[] }
```

事件链路：`multi-pass-generator.ts` → SSE → `sse-consumer.ts` → `useGeneration.ts` → `page.tsx`

### 状态管理

- `generationMode` state 定义在 `app/editor/page.tsx`
- 通过 props 传递给 `AICopilotPanel`（UI）和 `useGeneration`（API 调用）
- 新建对话时重置为 `'auto'`
- 不持久化到数据库，每次打开编辑器默认 `'auto'`

## 缓存

mode 已纳入缓存 key（`lib/cache/cache-key.ts`），三种模式各自独立缓存。同一个 prompt 用不同模式生成的结果不会互相覆盖。

高质量模式的结果**不写入缓存**（多轮生成的结果更复杂且不常重复）。

## 资源消耗

| 模式 | LLM 调用次数 | 相对耗时 |
|------|-------------|----------|
| 快速 | 1 | 1x |
| 自动（走快速） | 1 | 1x |
| 自动（走高质量） | 3-6 | 3-6x |
| 高质量 | 3-6 | 3-6x |

### 成本控制策略

| 策略 | 说明 |
|------|------|
| 最大步骤数 | Planner 最多输出 4 个步骤 |
| 自检修复上限 | 最多 1 次修复循环 |
| 超时 | 整体 120 秒 |
| 降级机制 | 超时/超预算/LLM 错误 → 输出当前最佳结果 |

## 文件结构

```
lib/generation/
├── types.ts                  # 共享类型定义
├── complexity-assessor.ts    # 自动模式的复杂度评估
├── planner.ts                # 多轮生成的步骤规划
├── multi-pass-generator.ts   # 多轮生成调度器
└── critic.ts                 # 规则校验 + LLM 评审

components/ai/
└── GenerationModeToggle.tsx  # 模式切换 UI 组件
```
