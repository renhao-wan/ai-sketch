/**
 * 生成结果的校验器
 * 规则校验：不消耗 token，检查结构性问题
 * LLM 评审：消耗 token，评估语义和质量
 */

import { callLLM } from '@/lib/llm/client';
import type { LLMConfig, LLMMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { CritiqueResult } from './types';

/** 规则校验：检查代码的结构性问题 */
export function ruleCheck(code: string, format: DiagramFormat): CritiqueResult {
  const issues: string[] = [];

  if (!code || code.trim().length === 0) {
    return { passed: false, issues: ['代码为空'], severity: 'error' };
  }

  if (format === 'excalidraw') {
    issues.push(...checkExcalidraw(code));
  } else if (format === 'mermaid') {
    issues.push(...checkMermaid(code));
  } else if (format === 'drawio') {
    issues.push(...checkDrawio(code));
  }

  const hasErrors = issues.some(i => i.startsWith('[ERROR]'));
  return {
    passed: issues.length === 0,
    issues: issues.map(i => i.replace(/^\[(ERROR|WARNING)\]\s*/, '')),
    severity: hasErrors ? 'error' : 'warning',
  };
}

/** Excalidraw 规则校验 */
function checkExcalidraw(code: string): string[] {
  const issues: string[] = [];

  let elements: unknown[];
  try {
    const parsed = JSON.parse(code);
    elements = Array.isArray(parsed) ? parsed : (parsed.elements || []);
  } catch {
    return ['[ERROR] JSON 解析失败'];
  }

  if (elements.length === 0) {
    return ['[ERROR] 元素列表为空'];
  }

  // 连线断开检测
  const elementIds = new Set(elements.map((e) => (e as Record<string, unknown>).id as string));
  for (const el of elements) {
    const elem = el as Record<string, unknown>;
    if (elem.type === 'arrow' || elem.type === 'line') {
      const startBinding = elem.startBinding as Record<string, unknown> | null;
      const endBinding = elem.endBinding as Record<string, unknown> | null;
      if (startBinding) {
        const startId = startBinding.elementId as string;
        if (startId && !elementIds.has(startId)) {
          issues.push(`[ERROR] 箭头 ${elem.id} 的起始元素 ${startId} 不存在`);
        }
      }
      if (endBinding) {
        const endId = endBinding.elementId as string;
        if (endId && !elementIds.has(endId)) {
          issues.push(`[ERROR] 箭头 ${elem.id} 的目标元素 ${endId} 不存在`);
        }
      }
    }
  }

  // 边界越界检测
  for (const el of elements) {
    const elem = el as Record<string, unknown>;
    const x = elem.x as number;
    const y = elem.y as number;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x < -1000 || x > 5000 || y < -1000 || y > 5000) {
        issues.push(`[WARNING] 元素 ${elem.id} 坐标越界 (${x}, ${y})`);
      }
    }
  }

  return issues;
}

/** Mermaid 规则校验 */
function checkMermaid(code: string): string[] {
  const issues: string[] = [];
  const lines = code.split('\n').filter(l => l.trim());

  // 检查方向声明
  const hasDirection = lines.some(l =>
    /^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/i.test(l.trim()),
  );
  if (!hasDirection) {
    issues.push('[WARNING] 缺少方向声明（TD/TB/RL/LR）');
  }

  // 检查语法关键字
  const validStarters = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
    'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap'];
  const firstLine = lines[0]?.trim().toLowerCase() || '';
  const hasValidStarter = validStarters.some(s => firstLine.startsWith(s.toLowerCase()));
  if (!hasValidStarter) {
    issues.push('[ERROR] 缺少有效的图表类型声明');
  }

  return issues;
}

/** Draw.io 规则校验 */
function checkDrawio(code: string): string[] {
  const issues: string[] = [];

  if (!code.includes('<mxfile>') && !code.includes('<mxGraphModel>')) {
    issues.push('[ERROR] 缺少有效的 Draw.io XML 结构');
  }

  // 检查 XML 基本闭合（仅匹配 mxCell 标签的闭合）
  const cellCount = (code.match(/<mxCell/g) || []).length;
  const selfClosedCount = (code.match(/<mxCell[^>]*\/>/g) || []).length;
  const closedCount = (code.match(/<\/mxCell>/g) || []).length;
  const cellCloseCount = selfClosedCount + closedCount;
  if (cellCount > 0 && cellCloseCount < cellCount) {
    issues.push('[WARNING] mxCell 标签可能未正确闭合');
  }

  return issues;
}

/** LLM 评审：评估生成结果的质量 */
export async function llmCritique(
  config: LLMConfig,
  userInput: string,
  code: string,
  format: DiagramFormat,
  ruleIssues: string[],
  signal?: AbortSignal,
): Promise<{ issues: string[]; fixedCode: string | null }> {
  const critiqueMessages: LLMMessage[] = [
    {
      role: 'system',
      content: `你是一个图表代码质量评审专家。检查以下代码的问题并给出修复建议。

输出严格的 JSON 格式，不要包含其他文字：
{
  "issues": ["问题1", "问题2"],
  "fixedCode": "修复后的完整代码，如果没有需要修复的则为 null"
}`,
    },
    {
      role: 'user',
      content: `用户需求：${userInput}
图表格式：${format}
规则校验发现的问题：${ruleIssues.join(', ') || '无'}

当前代码：
${code}

请评审并输出 JSON。`,
    },
  ];

  let responseJson = '';
  await callLLM(config, critiqueMessages, (chunk) => {
    responseJson += chunk;
  }, signal);

  // 括号平衡匹配提取 JSON
  const startIdx = responseJson.indexOf('{');
  if (startIdx === -1) {
    return { issues: ['LLM 评审未返回有效 JSON'], fixedCode: null };
  }
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < responseJson.length; i++) {
    if (responseJson[i] === '{') depth++;
    else if (responseJson[i] === '}') depth--;
    if (depth === 0) { endIdx = i; break; }
  }
  if (endIdx === -1) {
    return { issues: ['LLM 评审未返回有效 JSON'], fixedCode: null };
  }

  try {
    const result = JSON.parse(responseJson.slice(startIdx, endIdx + 1));
    return {
      issues: Array.isArray(result.issues) ? result.issues : [],
      fixedCode: result.fixedCode || null,
    };
  } catch {
    return { issues: ['LLM 评审返回的 JSON 解析失败'], fixedCode: null };
  }
}
