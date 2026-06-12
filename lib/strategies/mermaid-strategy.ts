/**
 * Mermaid diagram strategy
 * Generates Mermaid syntax for flowcharts, sequence diagrams, class diagrams, etc.
 */

import type { DiagramStrategy, ValidationResult } from '@/lib/types/diagram-strategy';
import { MERMAID_SYSTEM_PROMPT, buildMermaidUserPrompt, MERMAID_TYPE_MAP } from '@/lib/prompts/mermaid';
import { CHART_TYPES, getChartTypeName } from '@/lib/diagram/constants';
import { stripCodeFences } from '@/lib/diagram/json-repair';
import { createExportBlob, identityOptimize, buildImagePrompt } from './helpers';

// Chart type to Mermaid diagram type mapping - now imported from prompts module

// Valid Mermaid diagram starters
const VALID_STARTS = [
  'flowchart', 'graph', 'sequenceDiagram', 'classDiagram',
  'erDiagram', 'gantt', 'pie', 'stateDiagram', 'journey',
  'mindmap', 'timeline', 'block-beta', 'sankey-beta', 'xychart-beta',
  'requirementDiagram', 'gitGraph', 'C4Context', 'C4Container', 'C4Component',
];

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
    return buildMermaidUserPrompt(userInput, chartType);
  }

  postProcess(rawCode: string): string {
    if (!rawCode || typeof rawCode !== 'string') return rawCode;
    let code = stripCodeFences(rawCode);

    // 修复常见的 Mermaid 语法问题
    // 1. 移除代码块标记（如果有残留）
    code = code.replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '');

    // 2. 尝试提取 Mermaid 代码（如果前面有解释文字）
    const lines = code.split('\n');
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (VALID_STARTS.some(kw => trimmedLine.startsWith(kw))) {
        startIndex = i;
        break;
      }
    }

    if (startIndex > 0) {
      // Found valid Mermaid code after some prefix text
      code = lines.slice(startIndex).join('\n');
    }

    // 3. 修复箭头语法
    code = code.replace(/-- >/g, '-->');
    code = code.replace(/== >/g, '==>');

    // 4. 确保 flowchart 方向声明存在
    if (code.trim().startsWith('flowchart') && !code.trim().match(/^flowchart\s+(TD|LR|TB|RL|BT)/i)) {
      code = code.replace(/^flowchart/i, 'flowchart TD');
    }

    return code.trim();
  }

  optimize(code: string): string {
    return identityOptimize(code);
  }

  validate(code: string): ValidationResult {
    try {
      const trimmed = code.trim();
      if (!trimmed) return { valid: false, error: '代码为空' };

      // 检查是否以有效的 Mermaid 关键字开头
      const startsValid = VALID_STARTS.some(kw => trimmed.startsWith(kw));
      if (!startsValid) {
        return { valid: false, error: '代码不是有效的 Mermaid 语法（未以有效关键字开头）' };
      }

      // 基本语法检查：确保有内容（至少有一些节点或语句）
      // 对于流式代码，我们只检查基本结构，不检查完整语法
      const lines = trimmed.split('\n').filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        // 可能是不完整的流式代码，仍然返回 valid，让 MermaidCanvas 处理渲染错误
        return { valid: true, data: trimmed };
      }

      return { valid: true, data: trimmed };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  }

  createExportBlob(code: string): Blob {
    return createExportBlob(code, this.mimeType);
  }

  async generatePreview(code: string): Promise<string | null> {
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
      });
      const id = `preview-${crypto.randomUUID()}`;
      const { svg } = await mermaid.render(id, code.trim());
      if (!svg) return null;
      // 移除固定宽高，确保 SVG 能缩放适配容器
      return svg
        .replace(/<svg([^>]*)width="[^"]*"/, '<svg$1')
        .replace(/<svg([^>]*)height="[^"]*"/, '<svg$1');
    } catch (e) {
      console.error('[MermaidPreview] error:', e);
      return null;
    }
  }

  generateImagePrompt(chartType: string): string {
    return buildImagePrompt(chartType, 'Mermaid', CHART_TYPES as Record<string, string>, '只输出 Mermaid 代码，不要包含代码块标记。');
  }

  ruleCheck(code: string) {
    const issues: string[] = [];
    const lines = code.split('\n').filter(l => l.trim());

    const hasDirection = lines.some(l =>
      /^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/i.test(l.trim()),
    );
    if (!hasDirection) {
      issues.push('缺少方向声明（TD/TB/RL/LR）');
    }

    const validStarters = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
      'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap'];
    const firstLine = lines[0]?.trim().toLowerCase() || '';
    const hasValidStarter = validStarters.some(s => firstLine.startsWith(s.toLowerCase()));
    if (!hasValidStarter) {
      issues.push('缺少有效的图表类型声明');
    }

    const hasErrors = !hasValidStarter;
    return { passed: issues.length === 0, issues, severity: hasErrors ? 'error' as const : 'warning' as const };
  }

  mergeCode(existing: string, incoming: string): string {
    const MERMAID_DECLARATION_RE = /^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|gantt|pie|stateDiagram|mindmap|timeline|block-beta|requirementDiagram|gitGraph)\b/i;
    const incomingLines = incoming.split('\n');
    const newLines = incomingLines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !MERMAID_DECLARATION_RE.test(trimmed);
    });
    return existing + '\n' + newLines.join('\n');
  }
}

export const mermaidStrategy: DiagramStrategy = new MermaidStrategy();
