/**
 * Excalidraw diagram strategy
 * Extracts existing Excalidraw-specific logic into the strategy pattern.
 */

import type { DiagramStrategy, ValidationResult } from '@/lib/types/diagram-strategy';
import { EXCALIDRAW_SYSTEM_PROMPT, buildExcalidrawUserPrompt } from '@/lib/prompts/excalidraw';
import { CHART_TYPES } from '@/lib/diagram/constants';
import { optimizeExcalidrawCode } from '@/lib/diagram/optimize-arrows';
import { repairJsonClosure, stripCodeFences, extractFirstJsonArray, fixUnquotedKeys, fixTrailingCommas, fixSingleQuotes, removeJsonComments, fixSpecialValues, fixCommaInsteadOfColon, fixColonInsteadOfComma } from '@/lib/diagram/json-repair';
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

    // Step 1: Basic cleanup
    let processed = stripCodeFences(rawCode);

    // Step 2: Apply all fixes in sequence
    const applyFixes = (code: string): string => {
      let result = code;
      result = removeJsonComments(result);      // Remove comments first
      result = fixSingleQuotes(result);         // Fix single quotes
      result = fixSpecialValues(result);        // Fix NaN, Infinity, undefined
      result = fixTrailingCommas(result);       // Fix trailing commas
      result = fixColonInsteadOfComma(result);  // Fix colon instead of comma (must be before fixCommaInsteadOfColon)
      result = fixCommaInsteadOfColon(result);  // Fix comma instead of colon
      result = fixUnquotedKeys(result);         // Fix unquoted keys
      result = repairJsonClosure(result);       // Fix unclosed brackets/quotes
      return result;
    };

    // Step 3: Try parsing with all fixes
    processed = applyFixes(processed);
    try {
      JSON.parse(processed);
      return processed;
    } catch {
      // First attempt failed, try with unescaped quotes fix
      processed = fixUnescapedQuotes(processed);
      processed = applyFixes(processed);
      try {
        JSON.parse(processed);
        return processed;
      } catch {
        // Second attempt failed, return best effort
        return processed;
      }
    }
  }

  optimize(code: string): string {
    let optimized = optimizeExcalidrawCode(code);
    optimized = cleanupInvalidProperties(optimized);
    return optimized;
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

      // 确保数值字段是数字类型，避免 toFixed 错误
      const sanitizedElements = rawElements.map(el => {
        if (!el || typeof el !== 'object') return el;
        const sanitized = { ...el };
        // 转换常见的数值字段
        const numericFields = ['x', 'y', 'width', 'height', 'angle', 'strokeWidth', 'opacity', 'roundness', 'fontSize', 'baseline'];
        for (const field of numericFields) {
          if (field in sanitized && typeof sanitized[field] === 'string') {
            const num = Number(sanitized[field]);
            if (!isNaN(num)) {
              sanitized[field] = num;
            }
          }
        }
        return sanitized;
      });

      const converted = convertToExcalidrawElements(sanitizedElements, { regenerateIds: true });
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
      const existingElements: Record<string, unknown>[] = Array.isArray(existingArr) ? existingArr : (existingArr.elements || []);
      const incomingElements: Record<string, unknown>[] = Array.isArray(incomingArr) ? incomingArr : (incomingArr.elements || []);

      // 按 id 去重：保留 existing 中的元素，incoming 中只添加不存在的
      const existingIds = new Set(existingElements.map(el => el.id as string));
      const newElements = incomingElements.filter(el => !existingIds.has(el.id as string));

      return JSON.stringify([...existingElements, ...newElements]);
    } catch (e) {
      console.warn('[ExcalidrawStrategy] 合并失败，保留已有代码:', (e as Error).message);
      return existing;
    }
  }
}

/**
 * 清理无效属性，避免渲染异常
 * 1. 移除无效的属性键名（以 # 开头的）
 * 2. 为 text 元素移除不必要的 strokeWidth 和 backgroundColor
 * 3. 清理空的 label
 * 4. 修复断开的箭头绑定（引用不存在的元素）
 */
function cleanupInvalidProperties(codeString: string): string {
  if (!codeString || typeof codeString !== 'string') {
    return codeString;
  }

  try {
    const cleanedCode = codeString.trim();
    const arrayStr = extractFirstJsonArray(cleanedCode);
    if (!arrayStr) {
      return codeString;
    }

    const elements = JSON.parse(arrayStr) as Record<string, unknown>[];
    if (!Array.isArray(elements)) {
      return codeString;
    }

    // 收集所有元素 ID
    const elementIds = new Set<string>();
    elements.forEach(el => {
      if (el.id && typeof el.id === 'string') {
        elementIds.add(el.id);
      }
    });

    const cleanedElements = elements.map(el => {
      const cleaned = { ...el };

      // 1. 移除无效的属性键名（以 # 开头的）
      Object.keys(cleaned).forEach(key => {
        if (key.startsWith('#')) {
          delete cleaned[key];
        }
      });

      // 2. 为 text 元素移除不必要的属性
      if (cleaned.type === 'text') {
        delete cleaned.strokeWidth;
        delete cleaned.backgroundColor;
      }

      // 3. 清理空的 label
      if (cleaned.label && typeof cleaned.label === 'object') {
        const label = cleaned.label as Record<string, unknown>;
        if (!label.text || (typeof label.text === 'string' && label.text.trim() === '')) {
          delete cleaned.label;
        }
      }

      // 4. 修复断开的箭头绑定
      if (cleaned.type === 'arrow' || cleaned.type === 'line') {
        // 检查 start 绑定
        if (cleaned.start && typeof cleaned.start === 'object') {
          const start = cleaned.start as Record<string, unknown>;
          if (start.id && typeof start.id === 'string' && !elementIds.has(start.id)) {
            // 引用的元素不存在，移除 id，保留 type
            delete start.id;
            if (!start.type) {
              // 如果没有 type，移除整个 start 绑定
              delete cleaned.start;
            }
          }
        }

        // 检查 end 绑定
        if (cleaned.end && typeof cleaned.end === 'object') {
          const end = cleaned.end as Record<string, unknown>;
          if (end.id && typeof end.id === 'string' && !elementIds.has(end.id)) {
            // 引用的元素不存在，移除 id，保留 type
            delete end.id;
            if (!end.type) {
              // 如果没有 type，移除整个 end 绑定
              delete cleaned.end;
            }
          }
        }
      }

      return cleaned;
    });

    return JSON.stringify(cleanedElements, null, 2);
  } catch (error) {
    console.error('Failed to cleanup invalid properties:', error);
    return codeString;
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
