/**
 * Mermaid 图表类型规范
 * 为 Mermaid 原生支持的图表类型定义设计规范
 */

/** Mermaid 图表类型规范 */
export const MERMAID_CHART_SPECS: Record<string, string> = {
  flowchart: `
### 流程图设计规范
- 使用 TD（自上而下）或 LR（从左到右）方向
- 开始节点用 [开始]，结束节点用 [结束]
- 判断节点用 {} 表示
- 使用 subgraph 分组相关步骤`,

  sequence: `
### 时序图设计规范
- 使用 participant 定义参与者
- 使用 ->> 表示实线箭头，-->> 表示虚线箭头
- 使用 Note 添加注释
- 使用 loop、alt、opt 表示控制流`,

  class: `
### UML类图设计规范
- 使用 class 定义类
- 使用 + 表示 public，- 表示 private
- 使用 <|-- 表示继承，*-- 表示组合，o-- 表示聚合`,

  er: `
### ER图设计规范
- 使用实体名称定义实体
- 使用 ||--|| 表示一对一，||--o{ 表示一对多
- 使用属性定义实体字段`,

  gantt: `
### 甘特图设计规范
- 使用 dateFormat 指定日期格式
- 使用 section 划分任务阶段
- 使用任务状态标记（done, active, crit）`,

  state: `
### 状态图设计规范
- 使用 [*] 表示初始和终止状态
- 使用 --> 表示状态转换
- 使用 : 添加转换说明`,

  mindmap: `
### 思维导图设计规范
- 使用 root((主题)) 定义中心节点
- 使用缩进表示层级关系
- 保持层级清晰，不宜过深`,

  timeline: `
### 时间线设计规范
- 使用 section 划分时间段
- 使用 : 分隔时间和事件描述
- 按时间顺序排列事件`,

  orgchart: `
### 组织架构图设计规范
- 使用 block-beta 创建层级结构
- 使用嵌套块表示上下级关系
- 顶层为最高层级，逐级向下展开`,

  network: `
### 网络拓扑图设计规范
- 使用 block-beta 创建网络结构
- 使用不同形状表示不同设备类型
- 使用箭头表示连接关系`,

  architecture: `
### 架构图设计规范
- 使用 block-beta 创建系统架构
- 使用嵌套块表示模块和子模块
- 使用箭头表示组件间依赖关系`,

  tree: `
### 树形图设计规范
- 使用 mindmap 或 flowchart 创建树形结构
- 根节点在顶部，子节点逐级展开
- 保持层级清晰，分支合理`,

  swimlane: `
### 泳道图设计规范
- 使用 flowchart + subgraph 创建泳道
- 每个 subgraph 代表一个角色或部门
- 跨泳道的箭头表示协作流程`,

  concept: `
### 概念图设计规范
- 使用 mindmap 创建概念关系
- 核心概念在中心，相关概念向外展开
- 使用连接线表示概念间关系`,
};

/**
 * Mermaid 图表类型映射
 * 根据 Mermaid 11.x 支持的语法进行映射
 */
export const MERMAID_TYPE_MAP: Record<string, string> = {
  // 原生支持的图表类型
  flowchart: 'flowchart TD',
  mindmap: 'mindmap',
  sequence: 'sequenceDiagram',
  class: 'classDiagram',
  er: 'erDiagram',
  gantt: 'gantt',
  timeline: 'timeline',
  state: 'stateDiagram-v2',

  // 使用 block-beta 实现的图表类型（Mermaid 11.x 实验性功能）
  orgchart: 'block-beta',
  network: 'block-beta',
  architecture: 'block-beta',
  matrix: 'block-beta',

  // 使用 mindmap 实现的图表类型
  tree: 'mindmap',
  concept: 'mindmap',

  // 使用 flowchart + subgraph 实现的图表类型
  swimlane: 'flowchart TD',
  dataflow: 'flowchart LR',
};

/**
 * 自动模式下的图表类型选择指南
 * 只包含 Mermaid 原生支持的图表类型
 */
export const MERMAID_AUTO_MODE_GUIDE = `请根据用户需求，智能选择最合适的 Mermaid 图表类型来呈现信息。

## 可选图表类型
- **flowchart**：流程图，适合展示流程、步骤、决策逻辑
- **sequenceDiagram**：时序图，适合展示系统交互、消息传递
- **classDiagram**：类图，适合展示类结构、继承关系
- **erDiagram**：ER图，适合展示数据库实体关系
- **gantt**：甘特图，适合展示项目进度
- **stateDiagram-v2**：状态图，适合展示状态转换
- **mindmap**：思维导图，适合展示概念关系
- **timeline**：时间线，适合展示事件发展
- **block-beta**：块图，适合展示架构、网络拓扑（实验性）`;

/**
 * 不支持的图表类型列表
 * 这些类型在 Mermaid 中没有对应的实现方式
 */
export const UNSUPPORTED_MERMAID_TYPES = [
  'fishbone',
  'swot',
  'pyramid',
  'funnel',
  'venn',
  'infographic',
] as const;
