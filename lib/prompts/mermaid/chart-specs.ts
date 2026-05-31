/**
 * Mermaid 图表类型规范
 * 为 Mermaid 原生支持的图表类型定义设计规范
 */

/** Mermaid 图表类型规范 */
export const MERMAID_CHART_SPECS: Record<string, string> = {
  flowchart: `
### 流程图设计规范
- 使用 TD（自上而下）方向
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
};

/** Mermaid 图表类型映射 */
export const MERMAID_TYPE_MAP: Record<string, string> = {
  flowchart: 'flowchart TD',
  mindmap: 'mindmap',
  orgchart: 'flowchart TD',
  sequence: 'sequenceDiagram',
  class: 'classDiagram',
  er: 'erDiagram',
  gantt: 'gantt',
  timeline: 'timeline',
  tree: 'flowchart TD',
  network: 'flowchart TD',
  architecture: 'flowchart TD',
  dataflow: 'flowchart LR',
  state: 'stateDiagram-v2',
  swimlane: 'flowchart TD',
  concept: 'flowchart TD',
  fishbone: 'flowchart TD',
  swot: 'flowchart TD',
  pyramid: 'flowchart TD',
  funnel: 'flowchart TD',
  venn: 'flowchart TD',
  matrix: 'flowchart TD',
  infographic: 'flowchart TD',
};

/** 自动模式下的图表类型选择指南 */
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
- **pie**：饼图，适合展示占比关系`;
