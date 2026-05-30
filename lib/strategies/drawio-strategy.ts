/**
 * Draw.io diagram strategy
 * Generates Draw.io XML (mxGraphModel format) for diagrams.
 */

import type { DiagramStrategy, ValidationResult } from '@/types/diagram-strategy';
import { CHART_TYPES, getChartTypeName } from '@/lib/diagram/constants';
import { stripCodeFences } from '@/lib/diagram/json-repair';
import { createExportBlob, identityOptimize, buildImagePrompt } from './helpers';

// Chart type to Draw.io guidance mapping (only guidance, names come from CHART_TYPES)
const DRAWIO_GUIDANCE_MAP: Record<string, string> = {
  flowchart: '使用矩形表示处理步骤，菱形表示判断，圆角矩形表示开始/结束。使用箭头连接各节点表示流程方向。',
  mindmap: '使用中心节点作为主题，分支节点作为子主题。使用树形布局，分支均匀分布。',
  orgchart: '使用矩形表示人员或职位，使用树形层级结构自上而下排列。',
  sequence: '使用泳道表示参与者，使用箭头表示消息传递，按时间顺序从上到下排列。',
  class: '使用三段式矩形表示类（类名、属性、方法），使用箭头表示继承和关联关系。',
  er: '使用矩形表示实体，椭圆表示属性，菱形表示关系。使用连线标注基数。',
  gantt: '使用水平条形图表示任务，横轴为时间，纵轴为任务列表。',
  timeline: '使用水平线作为时间轴，使用节点和文本框标注事件。',
  tree: '使用树形层级结构，根节点在顶部，子节点均匀分布。',
  network: '使用不同形状表示不同类型的网络设备，使用连线表示网络连接。',
  architecture: '使用分层布局，矩形表示组件或服务，箭头表示依赖或数据流。',
  dataflow: '使用箭头表示数据流向，矩形表示处理过程，平行线表示数据存储。',
  state: '使用圆角矩形表示状态，箭头表示状态转换，标注触发条件。',
  swimlane: '使用泳道划分不同角色或部门，活动在泳道内按时间顺序排列。',
  concept: '使用节点表示概念，连线表示概念间的关系。',
  fishbone: '使用主干箭头指向问题，分支箭头指向原因分类。',
  swot: '使用2x2网格布局，四个象限分别表示优势、劣势、机会、威胁。',
  pyramid: '使用梯形或矩形从上到下递增排列，形成金字塔形状。',
  funnel: '使用梯形从上到下递减排列，形成漏斗形状。',
  venn: '使用圆形或椭圆表示集合，重叠区域表示交集。',
  matrix: '使用网格布局，行列交叉形成矩阵，表头用深色区分。',
  infographic: '使用模块化布局，结合图形、文字、数据展示信息。',
};

const DRAWIO_SYSTEM_PROMPT = `## 任务

根据用户的需求，生成规范、清晰、可直接在 Draw.io 中打开和编辑的 XML 图表代码。

## 输入

用户需求，可能是一个指令，也可能是一篇文章，或者是一张需要分析和转换的图片。

## 输出

有效的 Draw.io XML 代码（mxGraphModel 格式）。

### 输出约束
- 只输出 XML 代码，不要包含 \`\`\`xml 代码块标记
- 不要输出任何解释性文字
- 确保 XML 格式正确，可直接在 Draw.io 中打开

输出必须包含完整的 mxGraphModel 结构：
\`\`\`xml
<mxfile>
  <diagram name="Page-1" id="diagram-1">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <!-- 图表元素 -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
\`\`\`

## 图片处理特殊说明

如果输入包含图片，请：
1. 仔细分析图片中的视觉元素、文字、结构和关系
2. 识别图表类型（流程图、架构图、ER图等）
3. 提取关键信息和逻辑关系
4. 将图片内容准确转换为 Draw.io XML 格式
5. 保持原始设计的意图和信息完整性

## 执行步骤

### 步骤1：需求分析
- 理解并分析用户的需求
- 如果是一个简单的指令，首先根据指令创作一篇文章
- 仔细阅读并理解文章的整体结构和逻辑

### 步骤2：图表设计
- 提取关键概念、数据或流程
- 选择最合适的图表类型和布局方式
- 设计清晰的图表结构

## Draw.io XML 语法参考

### 基本节点
\`\`\`xml
<mxCell id="node-1" value="节点文本" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="120" height="60" as="geometry" />
</mxCell>
\`\`\`

### 常用样式
- **矩形**: \`rounded=0;whiteSpace=wrap;html=1;\`
- **圆角矩形**: \`rounded=1;whiteSpace=wrap;html=1;\`
- **椭圆**: \`ellipse;whiteSpace=wrap;html=1;\`
- **菱形**: \`rhombus;whiteSpace=wrap;html=1;\`
- **圆柱体（数据库）**: \`shape=cylinder3;whiteSpace=wrap;html=1;\`
- **云形**: \`ellipse;shape=cloud;whiteSpace=wrap;html=1;\`

### 连接线
\`\`\`xml
<mxCell id="edge-1" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="node-1" target="node-2">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
\`\`\`

### 带标签的连接线
\`\`\`xml
<mxCell id="edge-1" value="连接标签" style="edgeStyle=orthogonalEdgeStyle;fontSize=12;" edge="1" parent="1" source="node-1" target="node-2">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
\`\`\`

### 容器/分组
\`\`\`xml
<mxCell id="group-1" value="分组标题" style="swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1">
  <mxGeometry x="50" y="50" width="400" height="300" as="geometry" />
</mxCell>
<mxCell id="child-1" value="子节点" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="group-1">
  <mxGeometry x="30" y="40" width="120" height="60" as="geometry" />
</mxCell>
\`\`\`

## 最佳实践提醒

- **ID 唯一性**：每个元素的 id 必须唯一
- **父子关系**：通过 parent 属性建立层级关系
- **布局坐标**：使用合理的 x, y 坐标避免重叠
- **样式一致性**：同类元素使用相同样式
- **尺寸合理**：设置合适的 width 和 height

## 视觉风格指南
- **风格定位**: 科学教育、专业严谨、清晰简洁
- **文字辅助**: 节点标签简洁明了
- **结构清晰**: 保持图表层次分明，避免交叉连线
- **色彩方案**: 使用 2-4 种主色，保持视觉统一`;

class DrawioStrategy implements DiagramStrategy {
  readonly format = 'drawio' as const;
  readonly displayName = 'Draw.io';
  readonly codeLanguage = 'xml' as const;
  readonly fileExtension = 'drawio';
  readonly mimeType = 'application/xml';

  getSystemPrompt(): string {
    return DRAWIO_SYSTEM_PROMPT;
  }

  getUserPrompt(userInput: string, chartType: string): string {
    const promptParts: string[] = [];

    if (chartType && chartType !== 'auto') {
      const guidance = DRAWIO_GUIDANCE_MAP[chartType];
      const chartName = getChartTypeName(chartType);
      if (guidance) {
        promptParts.push(`请创建一个${chartName || chartType}类型的 Draw.io 图表。`);
        promptParts.push(`### ${chartName || chartType}设计规范\n${guidance}`);
      }
    } else {
      promptParts.push(
        '请根据用户需求，智能选择最合适的 Draw.io 图表类型来呈现信息。\n\n' +
        '## 可选图表类型\n' +
        '- **流程图 (flowchart)**：适合展示流程、步骤、决策逻辑\n' +
        '- **思维导图 (mindmap)**：适合展示概念关系、知识结构\n' +
        '- **组织架构图 (orgchart)**：适合展示组织结构、层级关系\n' +
        '- **时序图 (sequence)**：适合展示系统交互、消息传递\n' +
        '- **UML类图 (class)**：适合展示类结构、继承关系\n' +
        '- **ER图 (er)**：适合展示数据库实体关系\n' +
        '- **甘特图 (gantt)**：适合展示项目进度\n' +
        '- **架构图 (architecture)**：适合展示系统架构、技术栈\n' +
        '- **数据流图 (dataflow)**：适合展示数据流转\n' +
        '- **状态图 (state)**：适合展示状态转换\n' +
        '- **泳道图 (swimlane)**：适合展示跨部门流程'
      );
    }

    promptParts.push(`用户需求：\n${userInput}`);
    return promptParts.join('\n\n');
  }

  postProcess(rawCode: string): string {
    if (!rawCode || typeof rawCode !== 'string') return rawCode;
    let processed = stripCodeFences(rawCode);

    // Try DOMParser-based extraction first (handles nested/attributed tags correctly)
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(processed, 'text/xml');
      if (!doc.querySelector('parsererror')) {
        const mxfile = doc.querySelector('mxfile');
        if (mxfile) return new XMLSerializer().serializeToString(mxfile);
        const mxGraphModel = doc.querySelector('mxGraphModel');
        if (mxGraphModel) return new XMLSerializer().serializeToString(mxGraphModel);
      }
    }

    // Fallback to regex (non-greedy)
    const mxfileMatch = processed.match(/<mxfile[\s\S]*?<\/mxfile>/);
    if (mxfileMatch) return mxfileMatch[0];

    const mxGraphMatch = processed.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
    if (mxGraphMatch) return mxGraphMatch[0];

    // No valid XML structure found — return empty so validate() gets a clean signal
    return '';
  }

  optimize(code: string): string {
    return identityOptimize(code);
  }

  validate(code: string): ValidationResult {
    try {
      const trimmed = code.trim();
      if (!trimmed) return { valid: false, error: '代码为空' };

      if (!trimmed.includes('<mxGraphModel') && !trimmed.includes('<mxfile')) {
        return { valid: false, error: '不是有效的 Draw.io XML（缺少 mxGraphModel 或 mxfile 标签）' };
      }

      // Validate XML structure if DOMParser is available
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, 'text/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
          return { valid: false, error: 'XML 解析错误：' + (parseError.textContent || '未知错误') };
        }
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
    return buildImagePrompt(chartType, 'Draw.io', CHART_TYPES as Record<string, string>, '只输出 Draw.io XML 代码，不要包含代码块标记。XML 必须包含完整的 mxfile/mxGraphModel 结构。');
  }
}

export const drawioStrategy: DiagramStrategy = new DrawioStrategy();
