/**
 * Excalidraw diagram strategy
 * Extracts existing Excalidraw-specific logic into the strategy pattern.
 */

import type { DiagramStrategy, ValidationResult } from '@/lib/types/diagram-strategy';
import { EXCALIDRAW_SYSTEM_PROMPT, buildExcalidrawUserPrompt } from '@/lib/prompts/excalidraw';
import { CHART_TYPES } from '@/lib/diagram/constants';
import { optimizeExcalidrawCode } from '@/lib/diagram/optimize-arrows';
import { repairJsonClosure, stripCodeFences, extractFirstJsonArray } from '@/lib/diagram/json-repair';
import { createExportBlob, buildImagePrompt } from './helpers';

/** Excalidraw 支持的元素类型 */
const VALID_ELEMENT_TYPES = new Set([
  'rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line',
  'freedraw', 'image', 'frame', 'embeddable',
]);

class ExcalidrawStrategy implements DiagramStrategy {
  readonly format = 'excalidraw' as const;
  readonly displayName = 'Excalidraw';
  readonly codeLanguage = 'json' as const;
  readonly fileExtension = 'json';
  readonly mimeType = 'application/json';

  getSystemPrompt(): string {
    return EXCALIDRAW_SYSTEM_PROMPT;
  }

  getUserPrompt(userInput: string, chartType: string): string {
    return buildExcalidrawUserPrompt(userInput, chartType);
  }

  postProcess(rawCode: string): string {
    if (!rawCode || typeof rawCode !== 'string') return rawCode;
    let processed = stripCodeFences(rawCode);
    processed = repairJsonClosure(processed);
    try {
      JSON.parse(processed);
      return processed;
    } catch {
      processed = fixUnescapedQuotes(processed);
      processed = repairJsonClosure(processed);
      try {
        JSON.parse(processed);
      } catch {
        // Second repair also failed — return original stripped code
        return stripCodeFences(rawCode);
      }
      return processed;
    }
  }

  optimize(code: string): string {
    return optimizeExcalidrawCode(code);
  }

  validate(code: string): ValidationResult {
    try {
      const cleaned = code.trim();
      const arrayStr = extractFirstJsonArray(cleaned);
      if (!arrayStr) return { valid: false, error: '代码中未找到有效的 JSON 数组' };
      const parsed = JSON.parse(arrayStr);
      if (!Array.isArray(parsed)) return { valid: false, error: '解析结果不是 JSON 数组' };

      // 校验每个元素的基本结构
      for (let i = 0; i < parsed.length; i++) {
        const el = parsed[i];
        if (!el || typeof el !== 'object') {
          return { valid: false, error: `元素 [${i}] 不是有效对象` };
        }
        if (typeof el.type !== 'string' || !VALID_ELEMENT_TYPES.has(el.type)) {
          return { valid: false, error: `元素 [${i}] type 无效或缺失，收到: ${JSON.stringify(el.type)}` };
        }
        if (typeof el.x !== 'number' || typeof el.y !== 'number') {
          return { valid: false, error: `元素 [${i}] 缺少 x/y 坐标` };
        }
      }

      return { valid: true, data: parsed };
    } catch (e) {
      if (e instanceof SyntaxError) return { valid: false, error: 'JSON 语法错误：' + e.message };
      return { valid: false, error: '解析失败：' + (e as Error).message };
    }
  }

  createExportBlob(code: string): Blob {
    return createExportBlob(code, this.mimeType);
  }

  async generatePreview(code: string): Promise<string | null> {
    try {
      const { exportToSvg, convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
      const arrayStr = extractFirstJsonArray(code.trim());
      if (!arrayStr) return null;
      const rawElements = JSON.parse(arrayStr);
      if (!Array.isArray(rawElements) || rawElements.length === 0) return null;
      const converted = convertToExcalidrawElements(rawElements, { regenerateIds: true });
      const svg = await exportToSvg({
        elements: converted,
        appState: { viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
        files: null,
      });
      // 移除固定宽高
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      return svg.outerHTML;
    } catch {
      return null;
    }
  }

  generateImagePrompt(chartType: string): string {
    return buildImagePrompt(chartType, 'Excalidraw', CHART_TYPES, '将图片里的内容转换为excalidraw');
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
