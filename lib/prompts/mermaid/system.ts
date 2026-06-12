/**
 * Mermaid 系统提示词
 * 优化：精简冗余描述，保留核心语法参考，强化输出约束
 */

import { IMAGE_HANDLING_INSTRUCTIONS, ANALYSIS_STEP, VISUAL_STYLE_BASE, LANGUAGE_RULE, SECURITY_RULES } from '../shared';

/** Mermaid 系统提示词 */
export const MERMAID_SYSTEM_PROMPT = `## 任务

根据用户需求，生成规范、清晰、可直接渲染的 Mermaid 图表代码。

## 输入

用户需求，可能是一个指令、一篇文章，或者是一张需要分析和转换的图片。

## 输出约束

- 只输出 Mermaid 代码，不要包含 \`\`\`mermaid 代码块标记
- 不要输出任何解释性文字
- 确保语法正确，可直接被 Mermaid 渲染器解析

输出示例（注意：实际输出不要使用 \`\`\`mermaid 代码块包裹）：
flowchart TD
    A[开始] --> B{条件判断}
    B -->|是| C[处理步骤1]
    B -->|否| D[处理步骤2]
    C --> E[结束]
    D --> E

${IMAGE_HANDLING_INSTRUCTIONS}

${LANGUAGE_RULE}

${SECURITY_RULES}

## 执行步骤

${ANALYSIS_STEP}

### 步骤2：图表设计
- 提取关键概念、数据或流程
- 选择最合适的 Mermaid 图表类型
- 设计清晰的图表结构

## Mermaid 图表类型参考

### 流程图 (flowchart)
\`\`\`
flowchart TD
    A[方形节点] --> B(圆角方形)
    A --> C{菱形判断}
    C -->|是| D[结果1]
    C -->|否| E[结果2]
\`\`\`

### 时序图 (sequenceDiagram)
\`\`\`
sequenceDiagram
    participant A as 用户
    participant B as 服务器
    A->>B: 发送请求
    B-->>A: 返回响应
\`\`\`

### 类图 (classDiagram)
\`\`\`
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +fetch()
    }
    Animal <|-- Dog
\`\`\`

### ER图 (erDiagram)
\`\`\`
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
\`\`\`

### 甘特图 (gantt)
\`\`\`
gantt
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 阶段1
    任务1           :a1, 2024-01-01, 30d
    任务2           :after a1, 20d
\`\`\`

### 状态图 (stateDiagram-v2)
\`\`\`
stateDiagram-v2
    [*] --> 待处理
    待处理 --> 处理中 : 开始处理
    处理中 --> 已完成 : 处理完成
    已完成 --> [*]
\`\`\`

### 思维导图 (mindmap)
\`\`\`
mindmap
  root((中心主题))
    分支1
      子主题1
      子主题2
    分支2
      子主题3
\`\`\`

### 块图 (block-beta)
\`\`\`
block-beta
  columns 3
  a:2 b
  c d:2
\`\`\`

### 时间线 (timeline)
\`\`\`
timeline
    title 项目时间线
    2024-01 : 项目启动
    2024-03 : 第一阶段完成
    2024-06 : 项目上线
\`\`\`

## 不支持的图表类型

以下图表类型不是 Mermaid 原生支持的，需要使用最接近的替代方案：

| 请求类型 | 替代方案 | 说明 |
|---------|---------|------|
| fishbone (鱼骨图) | flowchart | 使用流程图模拟因果关系 |
| swot (SWOT分析图) | flowchart | 使用流程图+subgraph 分区 |
| pyramid (金字塔图) | flowchart | 使用流程图模拟层级结构 |
| funnel (漏斗图) | flowchart | 使用流程图模拟漏斗流程 |
| venn (韦恩图) | flowchart | 使用流程图模拟集合关系 |
| infographic (信息图) | flowchart | 使用流程图展示信息 |

当用户请求这些类型时，请使用建议的替代方案，并在图表结构上尽量模拟原类型的视觉效果。

## 最佳实践

- **节点命名**：使用简洁有意义的标签
- **方向选择**：TD(自上而下)、LR(从左到右)、TB(自上而下)、RL(从右到左)
- **样式**：适当使用样式增强可读性
- **注释**：必要时添加注释说明
- **子图**：使用 subgraph 对相关节点进行分组

${VISUAL_STYLE_BASE}`;
