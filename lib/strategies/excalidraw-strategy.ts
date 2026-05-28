/**
 * Excalidraw diagram strategy
 * Extracts existing Excalidraw-specific logic into the strategy pattern.
 */

import type { DiagramStrategy, ValidationResult } from '@/types/diagram-strategy';
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from '@/lib/prompts';
import { optimizeExcalidrawCode } from '@/lib/optimizeArrows';
import { repairJsonClosure } from '@/lib/json-repair';

// Chart type display names for image prompt
const CHART_TYPE_NAMES: Record<string, string> = {
  flowchart: '流程图',
  mindmap: '思维导图',
  orgchart: '组织架构图',
  sequence: '时序图',
  class: 'UML类图',
  er: 'ER图',
  gantt: '甘特图',
  timeline: '时间线',
  tree: '树形图',
  network: '网络拓扑图',
  architecture: '架构图',
  dataflow: '数据流图',
  state: '状态图',
  swimlane: '泳道图',
  concept: '概念图',
  fishbone: '鱼骨图',
  swot: 'SWOT分析图',
  pyramid: '金字塔图',
  funnel: '漏斗图',
  venn: '韦恩图',
  matrix: '矩阵图',
  infographic: '信息图',
};

function getChartTypeName(chartType: string): string {
  return CHART_TYPE_NAMES[chartType] || '自动';
}

class ExcalidrawStrategy implements DiagramStrategy {
  readonly format = 'excalidraw' as const;
  readonly displayName = 'Excalidraw';
  readonly codeLanguage = 'json' as const;
  readonly fileExtension = 'json';
  readonly mimeType = 'application/json';

  getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  getUserPrompt(userInput: string, chartType: string): string {
    return USER_PROMPT_TEMPLATE(userInput, chartType);
  }

  postProcess(rawCode: string): string {
    if (!rawCode || typeof rawCode !== 'string') return rawCode;
    let processed = rawCode.trim();
    processed = processed.replace(/^```(?:json|javascript|js)?\s*\n?/i, '');
    processed = processed.replace(/\n?```\s*$/, '');
    processed = processed.trim();
    processed = repairJsonClosure(processed);
    try {
      JSON.parse(processed);
      return processed;
    } catch {
      processed = fixUnescapedQuotes(processed);
      processed = repairJsonClosure(processed);
      return processed;
    }
  }

  optimize(code: string): string {
    return optimizeExcalidrawCode(code);
  }

  validate(code: string): ValidationResult {
    try {
      const cleaned = code.trim();
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!arrayMatch) return { valid: false, error: '代码中未找到有效的 JSON 数组' };
      const parsed = JSON.parse(arrayMatch[0]);
      if (!Array.isArray(parsed)) return { valid: false, error: '解析结果不是 JSON 数组' };
      return { valid: true, data: parsed };
    } catch (e) {
      if (e instanceof SyntaxError) return { valid: false, error: 'JSON 语法错误：' + e.message };
      return { valid: false, error: '解析失败：' + (e as Error).message };
    }
  }

  createExportBlob(code: string): Blob {
    return new Blob([code], { type: this.mimeType });
  }

  generateImagePrompt(chartType: string): string {
    const chartTypeText = chartType && chartType !== 'auto'
      ? `请将图片内容转换为${getChartTypeName(chartType)}类型的Excalidraw图表。`
      : '请分析图片内容并选择合适的图表类型转换为Excalidraw图表。';

    return `${chartTypeText}

请仔细分析图片中的：
1. 文字内容和标签
2. 图形元素和结构
3. 流程或连接关系
4. 布局和层次关系
5. 数据或数值信息

基于分析结果，创建清晰、准确的Excalidraw图表，确保：
- 保留图片中的所有关键信息
- 使用合适的图表类型展示内容
- 保持逻辑关系和结构
- 添加必要的文字说明

将图片里的内容转换为excalidraw`;
  }
}

function fixUnescapedQuotes(jsonString: string): string {
  let result = '';
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];
    if (escapeNext) { result += char; escapeNext = false; continue; }
    if (char === '\\') { result += char; escapeNext = true; continue; }
    if (char === '"') {
      if (!inString) { inString = true; result += char; }
      else {
        const nextNonWhitespace = jsonString.slice(i + 1).match(/^\s*(.)/);
        const nextChar = nextNonWhitespace ? nextNonWhitespace[1] : '';
        if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '') {
          inString = false; result += char;
        } else { result += '\\"'; }
      }
    } else { result += char; }
  }
  return result;
}

export const excalidrawStrategy: DiagramStrategy = new ExcalidrawStrategy();
