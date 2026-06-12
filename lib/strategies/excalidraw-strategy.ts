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

/** 缓存 excalidraw 模块的 import promise，避免重复加载 */
let excalidrawModulePromise: Promise<typeof import('@excalidraw/excalidraw')> | null = null;

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
      // 模块级缓存 import，避免重复加载大型依赖
      if (!excalidrawModulePromise) {
        excalidrawModulePromise = import('@excalidraw/excalidraw');
      }
      const { exportToSvg, convertToExcalidrawElements } = await excalidrawModulePromise;
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

  ruleCheck(code: string) {
    const issues: string[] = [];
    let elements: unknown[];
    try {
      const parsed = JSON.parse(code);
      elements = Array.isArray(parsed) ? parsed : (parsed.elements || []);
    } catch {
      return { passed: false, issues: ['JSON 解析失败'], severity: 'error' as const };
    }

    if (elements.length === 0) {
      return { passed: false, issues: ['元素列表为空'], severity: 'error' as const };
    }

    // 连线断开检测
    const elementIds = new Set(elements.map(e => (e as Record<string, unknown>).id as string));
    for (const el of elements) {
      const elem = el as Record<string, unknown>;
      if (elem.type === 'arrow' || elem.type === 'line') {
        const startBinding = elem.startBinding as Record<string, unknown> | null;
        const endBinding = elem.endBinding as Record<string, unknown> | null;
        if (startBinding?.elementId && !elementIds.has(startBinding.elementId as string)) {
          issues.push(`箭头 ${elem.id} 的起始元素 ${startBinding.elementId} 不存在`);
        }
        if (endBinding?.elementId && !elementIds.has(endBinding.elementId as string)) {
          issues.push(`箭头 ${elem.id} 的目标元素 ${endBinding.elementId} 不存在`);
        }
      }
    }

    const hasErrors = issues.some(i => i.includes('不存在'));
    return { passed: issues.length === 0, issues, severity: hasErrors ? 'error' as const : 'warning' as const };
  }

  mergeCode(existing: string, incoming: string): string {
    try {
      const existingArr = JSON.parse(this.postProcess(existing));
      const incomingArr = JSON.parse(this.postProcess(incoming));
      const existingElements = Array.isArray(existingArr) ? existingArr : (existingArr.elements || []);
      const incomingElements = Array.isArray(incomingArr) ? incomingArr : (incomingArr.elements || []);
      return JSON.stringify([...existingElements, ...incomingElements]);
    } catch (e) {
      console.warn('[ExcalidrawStrategy] 合并失败，保留已有代码:', (e as Error).message);
      return existing;
    }
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
