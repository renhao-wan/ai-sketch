# 自定义 AI 操作设计文档

## 概述

本设计文档描述了如何为 AI Sketch 添加用户自定义 AI 操作功能。用户可以创建自定义操作，最多 4 个操作显示在画布上，少于 4 个时空间不变平均分布。

## 需求总结

### 核心需求

1. **内置操作**：4 个固定不可修改（布局、美化、简化、解释）
2. **自定义操作**：用户可以创建新的，存储在数据库中
3. **管理界面**：设置页面中，快捷键上面
4. **画布显示**：最多 4 个操作，少于 4 个时空间不变平均分布
5. **配置方式**：
   - 基础配置：操作名称、提示词
   - 高级设置：图标、操作类型（修改图表/生成说明）
6. **后端包装**：根据操作类型自动添加系统提示词规范
7. **存储方式**：数据库
8. **执行方式**：复用 /api/ai-action 接口

### 约束条件

- 内置操作不可修改
- 最多 4 个操作显示在画布上
- 自定义操作需要强约束力的系统提示词
- 导出功能只在有文字输出时显示

## 设计方案

### 1. 数据库设计

#### custom_actions 表

存储用户自定义的 AI 操作。

```sql
CREATE TABLE custom_actions (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL,            -- 操作名称
  prompt TEXT NOT NULL,          -- 用户提示词
  icon TEXT DEFAULT 'Zap',       -- 图标名称
  action_type TEXT DEFAULT 'modify', -- 'modify' 或 'explain'
  enabled INTEGER DEFAULT 1,    -- 是否启用
  sort_order INTEGER DEFAULT 0, -- 排序顺序
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### canvas_actions 表

控制画布上显示哪些操作以及顺序。

```sql
CREATE TABLE canvas_actions (
  id TEXT PRIMARY KEY,           -- UUID
  action_type TEXT NOT NULL,     -- 'builtin' 或 'custom'
  action_id TEXT NOT NULL,       -- 内置操作名称或自定义操作 ID
  sort_order INTEGER DEFAULT 0, -- 排序顺序
  UNIQUE(action_type, action_id)
);
```

#### 默认数据

```sql
-- 默认显示 4 个内置操作
INSERT INTO canvas_actions VALUES ('1', 'builtin', 'layout', 0);
INSERT INTO canvas_actions VALUES ('2', 'builtin', 'beautify', 1);
INSERT INTO canvas_actions VALUES ('3', 'builtin', 'simplify', 2);
INSERT INTO canvas_actions VALUES ('4', 'builtin', 'explain', 3);
```

### 2. API 设计

#### 自定义操作 CRUD

```
GET    /api/custom-actions          # 获取所有自定义操作
POST   /api/custom-actions          # 创建自定义操作
GET    /api/custom-actions/[id]     # 获取单个自定义操作
PUT    /api/custom-actions/[id]     # 更新自定义操作
DELETE /api/custom-actions/[id]     # 删除自定义操作
```

#### 画布操作管理

```
GET    /api/canvas-actions          # 获取画布上显示的操作列表
PUT    /api/canvas-actions          # 更新画布操作（选择和排序）
```

#### 执行操作

```
POST   /api/ai-action
```

**请求体变更**：

```typescript
// 原来
{
  code: string;
  format: string;
  action: 'layout' | 'beautify' | 'simplify' | 'explain';
  configId?: string;
}

// 现在
{
  code: string;
  format: string;
  action: string;  // 内置操作名称或 'custom'
  actionId?: string; // 自定义操作 ID（当 action='custom' 时）
  configId?: string;
}
```

### 3. 前端组件设计

#### FloatingAIActions.tsx（修改）

- 从数据库加载画布操作列表
- 动态渲染操作按钮
- 最多 4 个，少于 4 个时空间不变平均分布

**布局逻辑**：

```typescript
// 最多 4 个操作
const maxActions = 4;
const actions = canvasActions.slice(0, maxActions);

// 少于 4 个时，空间不变，平均分布
// 使用 flexbox 的 space-evenly 或固定高度容器
```

#### AIActionsSettings.tsx（新增）

设置页面中的"AI 操作"标签页，位于快捷键上面。

**功能**：
- 显示操作列表（内置 + 自定义）
- 选择哪些显示在画布上（复选框）
- 拖拽排序
- 创建/编辑/删除自定义操作

**界面结构**：

```
┌─────────────────────────────────────────────────────────────┐
│ AI 操作管理                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 画布上显示的操作 (最多 4 个，拖拽调整顺序):                 │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ ⚡ 布局优化  [内置]                                  │    │
│ │ 🎨 美化      [内置]                                  │    │
│ │ 📐 简化      [内置]                                  │    │
│ │ ✨ 解释      [内置]                                  │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ 自定义操作:                                                 │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ [+ 创建新操作]                                       │    │
│ │                                                     │    │
│ │ (暂无自定义操作)                                     │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### ActionEditor.tsx（新增）

操作编辑器，用于创建和编辑自定义操作。

**配置项**：

**基础配置（必填）**：
- 操作名称：显示在按钮上的名称
- 提示词：发送给 AI 的指令

**高级设置（可选）**：
- 图标：从图标库选择（默认 ⚡ Zap）
- 操作类型：
  - 修改图表 - AI 修改当前图表，直接渲染到画布
  - 生成说明 - AI 生成文字说明，显示在底部面板

**提示词规范提示**：

选择"修改图表"时：
```
提示: 请确保提示词要求 AI 输出修改后的图表代码
```

选择"生成说明"时：
```
提示: 请确保提示词要求 AI 输出文字说明
```

### 4. 执行逻辑设计

#### 后端提示词包装

```typescript
function buildPrompt(action: string, actionId: string | undefined, code: string, format: string) {
  if (action === 'custom' && actionId) {
    // 加载自定义操作
    const customAction = await getCustomAction(actionId);
    
    // 根据操作类型构建系统提示词
    const systemPrompt = customAction.action_type === 'modify' 
      ? MODIFY_SYSTEM_PROMPT 
      : EXPLAIN_SYSTEM_PROMPT;
    
    return {
      system: systemPrompt,
      user: `${customAction.prompt}\n\n当前图表代码：\n${code}`
    };
  }
  
  // 内置操作，使用原有逻辑
  return {
    system: getActionSystemPrompt(action, format),
    user: getActionUserPrompt(action, code, format)
  };
}
```

#### 系统提示词模板

**修改图表**：

```typescript
const MODIFY_SYSTEM_PROMPT = `你是图表代码优化专家。用户会提供图表代码和优化要求。

【强制规则】
1. 必须输出完整的图表代码
2. 禁止输出任何解释、说明或注释
3. 禁止使用 markdown 代码块包裹
4. 必须保持与输入相同的代码格式
5. 直接输出修改后的代码，不要添加任何前缀文字

违反以上规则将导致系统错误。`;
```

**生成说明**：

```typescript
const EXPLAIN_SYSTEM_PROMPT = `你是图表分析专家。用户会提供图表代码和分析要求。

【强制规则】
1. 必须输出详细的文字说明
2. 禁止输出任何代码
3. 必须使用 Markdown 格式
4. 必须包含图表结构分析、节点说明、流程描述
5. 使用清晰的中文描述

违反以上规则将导致系统错误。`;
```

#### 结果处理逻辑

```typescript
function handleResult(action: string, actionId: string | undefined, result: any) {
  if (action === 'custom' && actionId) {
    const customAction = getCustomAction(actionId);
    
    if (customAction.action_type === 'modify') {
      // 更新画布
      updateCanvas(result.code);
    } else {
      // 显示在上下文面板
      showInPanel(result.text);
    }
  } else {
    // 内置操作，使用原有逻辑
    handleBuiltinResult(action, result);
  }
}
```

## 实现阶段

### 阶段 1：基础架构（2-3 天）

1. 数据库表设计和迁移
2. API 路由实现（CRUD）
3. 基础组件框架

### 阶段 2：管理界面（2-3 天）

1. 设置页面中的 AI 操作管理
2. 操作列表、创建/编辑/删除
3. 显示选择和排序

### 阶段 3：执行逻辑（2-3 天）

1. 修改 /api/ai-action 接口
2. 后端提示词包装
3. 前端执行流程

## 测试策略

### 单元测试

- 数据库操作测试
- API 路由测试
- 提示词包装逻辑测试

### 集成测试

- 自定义操作创建和执行流程
- 画布操作管理流程
- 内置操作兼容性测试

### 端到端测试

- 完整的用户操作流程
- 边界条件测试（最多 4 个操作，空操作列表等）

## 风险和缓解措施

### 风险 1：提示词约束力不足

**问题**：AI 可能不遵守系统提示词规则

**缓解措施**：
- 使用强约束力的提示词模板
- 添加后处理逻辑验证输出格式
- 提供用户反馈机制

### 风险 2：性能问题

**问题**：频繁的数据库查询可能影响性能

**缓解措施**：
- 使用缓存机制
- 优化数据库查询
- 考虑批量加载

### 风险 3：用户体验

**问题**：配置界面可能过于复杂

**缓解措施**：
- 简化基础配置，只保留必要字段
- 高级设置默认折叠
- 提供清晰的提示和示例

## 未来扩展

### 可能的扩展功能

1. **导入导出**：支持导出/导入自定义操作配置
2. **操作模板**：提供预设的操作模板
3. **操作分享**：用户可以分享自定义操作
4. **操作统计**：统计操作使用频率
5. **操作分类**：支持操作分类和标签

### 扩展性考虑

- 数据库设计支持添加新字段
- API 设计支持版本控制
- 组件设计支持插件化扩展

## 总结

本设计文档详细描述了自定义 AI 操作功能的实现方案，包括数据库设计、API 设计、前端组件设计和执行逻辑设计。通过渐进式实现，可以确保功能的稳定性和可维护性。

该功能将大大增强 AI Sketch 的灵活性，让用户可以根据自己的需求创建个性化的 AI 操作，提升工作效率。
