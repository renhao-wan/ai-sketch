/**
 * Mermaid diagram strategy
 * Generates Mermaid syntax for flowcharts, sequence diagrams, class diagrams, etc.
 */

import type { DiagramStrategy, ValidationResult } from '@/types/diagram-strategy';
import { CHART_TYPES, getChartTypeName } from '@/lib/constants';
import { stripCodeFences } from '@/lib/json-repair';
import { createExportBlob, identityOptimize, buildImagePrompt } from './helpers';

// Chart type to Mermaid diagram type mapping (only mermaidType, names come from CHART_TYPES)
const MERMAID_TYPE_MAP: Record<string, string> = {
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

// Valid Mermaid diagram starters
const VALID_STARTS = [
  'flowchart', 'graph', 'sequenceDiagram', 'classDiagram',
  'erDiagram', 'gantt', 'pie', 'stateDiagram', 'journey',
  'mindmap', 'timeline', 'block-beta', 'sankey-beta', 'xychart-beta',
  'requirementDiagram', 'gitGraph', 'C4Context', 'C4Container', 'C4Component',
];

const MERMAID_SYSTEM_PROMPT = `## 任务

根据用户的需求，生成规范、清晰、可直接渲染的 Mermaid 图表代码。

## 输入

用户需求，可能是一个指令，也可能是一篇文章，或者是一张需要分析和转换的图片。

## 输出

有效的 Mermaid 语法代码。

### 输出约束
- 只输出 Mermaid 代码，不要包含 \`\`\`mermaid 代码块标记
- 不要输出任何解释性文字
- 确保语法正确，可直接被 Mermaid 渲染器解析

输出示例
\`\`\`
flowchart TD
    A[开始] --> B{条件判断}
    B -->|是| C[处理步骤1]
    B -->|否| D[处理步骤2]
    C --> E[结束]
    D --> E
\`\`\`

## 图片处理特殊说明

如果输入包含图片，请：
1. 仔细分析图片中的视觉元素、文字、结构和关系
2. 识别图表类型（流程图、时序图、类图、ER图等）
3. 提取关键信息和逻辑关系
4. 将图片内容准确转换为 Mermaid 语法
5. 保持原始设计的意图和信息完整性

## 执行步骤

### 步骤1：需求分析
- 理解并分析用户的需求
- 如果是一个简单的指令，首先根据指令创作一篇文章
- 仔细阅读并理解文章的整体结构和逻辑

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

## 最佳实践提醒

- **节点命名**：使用简洁有意义的标签
- **方向选择**：TD(自上而下)、LR(从左到右)、TB(自上而下)、RL(从右到左)
- **样式**：适当使用样式增强可读性
- **注释**：必要时添加注释说明
- **子图**：使用 subgraph 对相关节点进行分组

## 视觉风格指南
- **风格定位**: 科学教育、专业严谨、清晰简洁
- **文字辅助**: 节点标签简洁明了
- **结构清晰**: 保持图表层次分明，避免交叉连线`;

const MERMAID_CHART_SPECS: Record<string, string> = {
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

class MermaidStrategy implements DiagramStrategy {
  readonly format = 'mermaid' as const;
  readonly displayName = 'Mermaid';
  readonly codeLanguage = 'markdown' as const;
  readonly fileExtension = 'mmd';
  readonly mimeType = 'text/plain';

  getSystemPrompt(): string {
    return MERMAID_SYSTEM_PROMPT;
  }

  getUserPrompt(userInput: string, chartType: string): string {
    const promptParts: string[] = [];

    if (chartType && chartType !== 'auto') {
      const mermaidType = MERMAID_TYPE_MAP[chartType];
      const chartName = getChartTypeName(chartType);
      if (mermaidType) {
        promptParts.push(`请创建一个${chartName || chartType}类型的 Mermaid 图表，使用 \`${mermaidType}\` 语法。`);
        const spec = MERMAID_CHART_SPECS[chartType];
        if (spec) {
          promptParts.push(spec.trim());
        }
      }
    } else {
      promptParts.push(
        '请根据用户需求，智能选择最合适的 Mermaid 图表类型来呈现信息。\n\n' +
        '## 可选图表类型\n' +
        '- **flowchart**：流程图，适合展示流程、步骤、决策逻辑\n' +
        '- **sequenceDiagram**：时序图，适合展示系统交互、消息传递\n' +
        '- **classDiagram**：类图，适合展示类结构、继承关系\n' +
        '- **erDiagram**：ER图，适合展示数据库实体关系\n' +
        '- **gantt**：甘特图，适合展示项目进度\n' +
        '- **stateDiagram-v2**：状态图，适合展示状态转换\n' +
        '- **mindmap**：思维导图，适合展示概念关系\n' +
        '- **timeline**：时间线，适合展示事件发展\n' +
        '- **pie**：饼图，适合展示占比关系'
      );
    }

    promptParts.push(`用户需求：\n${userInput}`);
    return promptParts.join('\n\n');
  }

  postProcess(rawCode: string): string {
    if (!rawCode || typeof rawCode !== 'string') return rawCode;
    return stripCodeFences(rawCode);
  }

  optimize(code: string): string {
    return identityOptimize(code);
  }

  validate(code: string): ValidationResult {
    try {
      const trimmed = code.trim();
      if (!trimmed) return { valid: false, error: '代码为空' };
      const startsValid = VALID_STARTS.some(kw => trimmed.startsWith(kw));
      if (!startsValid) {
        return { valid: false, error: '代码不是有效的 Mermaid 语法（未以有效关键字开头）' };
      }
      return { valid: true, data: trimmed };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  }

  createExportBlob(code: string): Blob {
    return createExportBlob(code, this.mimeType);
  }

  generateImagePrompt(chartType: string): string {
    return buildImagePrompt(chartType, 'Mermaid', CHART_TYPES as Record<string, string>, '只输出 Mermaid 代码，不要包含代码块标记。');
  }
}

export const mermaidStrategy: DiagramStrategy = new MermaidStrategy();
