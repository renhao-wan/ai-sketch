# AI 操作按钮与底部面板重新设计

## 概述

重新设计编辑器右侧的浮动 AI 操作按钮和底部上下文面板，移除占位功能，实现真正的 AI 驱动操作。

## 功能范围

### 浮动按钮（4 个 AI 功能）

| 按钮 | 图标 | 功能描述 | 结果处理 |
|------|------|---------|---------|
| AI 布局 | LayoutGrid | 调用 LLM 分析图表结构，自动调整节点位置和间距 | 直接修改 `generatedCode` + `renderData` |
| AI 美化 | Palette | 调用 LLM 优化视觉风格（颜色、字体、对齐） | 直接修改 `generatedCode` + `renderData` |
| AI 简化 | Minimize2 | 调用 LLM 精简代码结构，去除冗余 | 直接修改 `generatedCode` + `renderData` |
| AI 解释 | HelpCircle | 调用 LLM 解释图表含义、逻辑、潜在问题 | 自动切换到底部"AI 解释"标签 |

### 底部面板（2 个标签）

| 标签 | 图标 | 内容 |
|------|------|------|
| 代码 | Code2 | CodeEditor 编辑器，支持编辑、应用、清空 |
| AI 解释 | Sparkles | 解释文本，内存中持久，刷新后丢失 |

### 移除的内容

- 浮动按钮：生成（Plus 图标，和侧边栏 AI 对话功能重复）
- 底部面板标签：版本对比（GitCompare）、日志（Terminal）

## 交互设计

### 布局/美化/简化流程

1. 用户点击浮动按钮
2. 按钮显示 loading 状态（spinner 图标）
3. 调用 `POST /api/ai-action` 端点，请求体：
   ```json
   {
     "code": "当前图表代码",
     "format": "excalidraw | mermaid | drawio",
     "action": "layout | beautify | simplify"
   }
   ```
4. LLM 返回修改后的代码
5. 前端更新 `generatedCode` 和 `renderData`，画布和代码编辑器同步刷新
6. 按钮恢复原状

### 解释流程

1. 用户点击"AI 解释"按钮
2. 按钮显示 loading 状态
3. 调用 `POST /api/ai-action` 端点，请求体：
   ```json
   {
     "code": "当前图表代码",
     "format": "excalidraw | mermaid | drawio",
     "action": "explain"
   }
   ```
4. LLM 返回解释文本
5. 前端自动切换到底部"AI 解释"标签，显示解释文本
6. 解释文本保存在内存状态中，用户可在代码和解释标签间切换

### 错误处理

- 网络错误：按钮恢复原状，显示通知提示
- LLM 返回格式错误：显示通知提示，不修改画布
- 无代码时点击：显示通知提示"请先生成图表"

## 技术实现

### API 端点

新建 `app/api/ai-action/route.ts`：

```typescript
interface AIActionRequest {
  code: string;
  format: DiagramFormat;
  action: 'layout' | 'beautify' | 'simplify' | 'explain';
}

interface AIActionResponse {
  result: string; // 修改后的代码（layout/beautify/simplify）或解释文本（explain）
}
```

- 复用 `llm-client.ts` 的流式调用能力
- 根据 `action` 选择不同的 system prompt
- 不涉及对话管理、消息保存
- 复用用户已配置的 LLM（API Key、模型、Base URL）
- 流式策略：layout/beautify/simplify 需要完整响应后一次性应用；explain 支持流式显示文本

### System Prompts

每个 action 对应一个专门的 system prompt：

- **layout**: "你是图表布局专家。分析用户提供的图表代码，自动调整节点位置和间距，使图表更整齐易读。只返回修改后的代码，不要解释。"
- **beautify**: "你是图表美化专家。优化图表的视觉风格，包括颜色搭配、字体大小、对齐方式。只返回修改后的代码，不要解释。"
- **simplify**: "你是代码简化专家。精简图表代码结构，去除冗余元素，合并重复定义。只返回修改后的代码，不要解释。"
- **explain**: "你是图表分析专家。解释用户提供的图表的含义、逻辑流程、关键节点和潜在问题。使用简洁的中文回答。"

### 前端状态

在 `page.tsx` 中新增状态：

```typescript
const [aiActionLoading, setAiActionLoading] = useState<string | null>(null); // 当前正在执行的 action
const [aiExplanation, setAiExplanation] = useState<string>(''); // AI 解释结果
```

### 组件修改

1. **FloatingAIActions.tsx**
   - 移除 `generate` 按钮
   - 添加 `simplify` 按钮（替换 `optimize`）
   - 添加 loading 状态支持
   - 按钮图标：布局(LayoutGrid)、美化(Palette)、简化(Minimize2)、解释(HelpCircle)

2. **BottomContextPanel.tsx**
   - 移除"版本对比"和"日志"标签
   - 保留"代码"和"AI 解释"标签
   - 添加 `explanation` prop 接收解释文本
   - 添加 `activeTab` / `onTabChange` prop 支持外部控制标签切换（点击"AI 解释"按钮时自动切换）

3. **page.tsx**
   - 实现 `handleAIAction` 函数，调用 `/api/ai-action`
   - 处理结果：布局/美化/简化更新代码和画布，解释更新状态并切换标签
   - 添加 loading 状态管理

## 数据流

```
用户点击按钮
    ↓
FloatingAIActions.onAction(actionId)
    ↓
page.tsx.handleAIAction(actionId)
    ↓
POST /api/ai-action { code, format, action }
    ↓
api-action/route.ts → llm-client.ts → LLM API
    ↓
LLM 返回结果
    ↓
前端处理：
  - layout/beautify/simplify → setGeneratedCode + setRenderData
  - explain → setAiExplanation + 切换到解释标签
```

## 不做的事情

- 不新建数据库表
- 不保存 AI 操作记录
- 不往侧边栏添加消息
- 不修改现有的对话管理逻辑
