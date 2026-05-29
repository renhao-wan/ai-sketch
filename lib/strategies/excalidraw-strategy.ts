/**
 * Excalidraw diagram strategy
 * Extracts existing Excalidraw-specific logic into the strategy pattern.
 */

import type { DiagramStrategy, ValidationResult } from '@/types/diagram-strategy';
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from '@/lib/prompts';
import { CHART_TYPES } from '@/lib/constants';
import { optimizeExcalidrawCode } from '@/lib/optimizeArrows';
import { repairJsonClosure, stripCodeFences } from '@/lib/json-repair';
import { createExportBlob, buildImagePrompt } from './helpers';

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
    let processed = stripCodeFences(rawCode);
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
    return createExportBlob(code, this.mimeType);
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
