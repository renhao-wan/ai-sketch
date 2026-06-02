/**
 * Draw.io diagram strategy
 * Generates Draw.io XML (mxGraphModel format) for diagrams.
 */

import type { DiagramStrategy, ValidationResult } from '@/lib/types/diagram-strategy';
import { DRAWIO_SYSTEM_PROMPT, buildDrawioUserPrompt, DRAWIO_GUIDANCE_MAP } from '@/lib/prompts/drawio';
import { CHART_TYPES, getChartTypeName } from '@/lib/diagram/constants';
import { stripCodeFences } from '@/lib/diagram/json-repair';
import { createExportBlob, identityOptimize, buildImagePrompt } from './helpers';

// Chart type to Draw.io guidance mapping - now imported from prompts module

// Draw.io system prompt - now imported from prompts module

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
    return buildDrawioUserPrompt(userInput, chartType);
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
