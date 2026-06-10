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

  /**
   * 从原始代码中提取 Draw.io XML。
   *
   * 设计说明（服务端/客户端职责）：
   * - 服务端（generate route）调用 postProcess 做初步清洗（去代码围栏、提取 XML 片段）
   * - 客户端（useGeneration / editor）调用 postProcess 做最终清洗
   * - 本方法使用纯字符串匹配提取 XML，不依赖 DOMParser，确保服务端和客户端行为一致
   * - validate() 负责 XML 合法性校验（客户端可用 DOMParser 做深度校验）
   */
  postProcess(rawCode: string): string {
    if (!rawCode || typeof rawCode !== 'string') return rawCode;
    let processed = stripCodeFences(rawCode);

    // 优先提取 mxfile 标签（完整 Draw.io 文件格式）
    const mxfileMatch = processed.match(/<mxfile[\s\S]*?<\/mxfile>/);
    if (mxfileMatch) return mxfileMatch[0];

    // 其次提取 mxGraphModel 标签（纯图表格式）
    const mxGraphMatch = processed.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
    if (mxGraphMatch) return mxGraphMatch[0];

    // 未找到有效 XML 结构，返回空字符串让 validate() 得到明确信号
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

  async generatePreview(code: string): Promise<string | null> {
    try {
      const { Graph, ModelXmlSerializer, getDefaultPlugins } = await import('@maxgraph/core');

      // 创建离屏容器
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:800px;height:600px;';
      document.body.appendChild(container);

      try {
        const graph = new Graph(container, undefined, getDefaultPlugins());
        const serializer = new ModelXmlSerializer(graph.getDataModel());

        // 提取 mxGraphModel
        let cleanXml = code.trim();
        const match = cleanXml.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
        if (match) cleanXml = match[0];

        serializer.import(cleanXml);

        // 等待渲染完成
        await new Promise(r => setTimeout(r, 50));

        // 提取 SVG
        const svgEl = container.querySelector('svg');
        if (!svgEl) return null;

        const cloned = svgEl.cloneNode(true) as SVGSVGElement;
        cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        // 移除固定宽高，让 SVG 自适应容器
        cloned.removeAttribute('width');
        cloned.removeAttribute('height');
        // 确保有 viewBox
        if (!cloned.getAttribute('viewBox')) {
          const bbox = graph.getGraphBounds();
          const scale = graph.getView().getScale();
          cloned.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width / scale} ${bbox.height / scale}`);
        }
        return new XMLSerializer().serializeToString(cloned);
      } finally {
        document.body.removeChild(container);
      }
    } catch (e) {
      console.error('[DrawioPreview]', e);
      return null;
    }
  }

  generateImagePrompt(chartType: string): string {
    return buildImagePrompt(chartType, 'Draw.io', CHART_TYPES as Record<string, string>, '只输出 Draw.io XML 代码，不要包含代码块标记。XML 必须包含完整的 mxfile/mxGraphModel 结构。');
  }
}

export const drawioStrategy: DiagramStrategy = new DrawioStrategy();
