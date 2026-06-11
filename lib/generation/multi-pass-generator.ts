/**
 * 多轮生成调度器
 * 按 Planner 输出的步骤列表，逐步调用 LLM 生成代码
 */

import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { getStrategy } from '@/lib/strategies/registry';
import type { LLMConfig, LLMMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationPlan, ProgressEvent, CritiqueEvent } from './types';
import { ruleCheck, llmCritique } from './critic';

/** SSE 事件发送器 */
export type EventSender = (event: string) => void;

/** 多轮生成的完整流程 */
export async function executeMultiPass(
  config: LLMConfig,
  plan: GenerationPlan,
  userInput: string,
  format: DiagramFormat,
  contextMessages: LLMMessage[],
  sendEvent: EventSender,
  signal?: AbortSignal,
): Promise<string> {
  const strategy = getStrategy(format);
  const totalSteps = plan.steps.length + 2; // 步骤 + critic + 可能的 repair
  let currentStep = 0;
  let accumulatedCode = '';

  // 按依赖顺序执行步骤
  const stepResults: string[] = [];

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    currentStep++;

    // 发送进度事件
    const progressEvent: ProgressEvent = {
      type: 'progress',
      step: currentStep,
      totalSteps,
      message: getStepMessage(step.type, step.description),
    };
    sendEvent(`data: ${JSON.stringify(progressEvent)}\n\n`);

    // 构建步骤的 LLM 消息
    const stepMessages = buildStepMessages(
      step.type, step.description, format,
      userInput, contextMessages, accumulatedCode,
      step.dependencies.map(d => stepResults[d]),
    );

    // 调用 LLM 生成这一步的代码
    let stepCode = '';
    await callLLM(config, stepMessages, (chunk) => {
      stepCode += chunk;
      // 实时推送内容 chunk
      sendEvent(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
    }, signal);

    // 后处理
    const processed = strategy.postProcess(stepCode);
    stepResults.push(processed);

    // 合并到累积代码
    if (step.type === 'nodes' && accumulatedCode === '') {
      accumulatedCode = processed;
    } else if (step.type === 'connections' || step.type === 'style') {
      accumulatedCode = mergeCode(accumulatedCode, processed, format);
    } else {
      // 多个 nodes 步骤：追加合并
      accumulatedCode = mergeCode(accumulatedCode, processed, format);
    }
  }

  // 最终优化
  accumulatedCode = strategy.optimize(accumulatedCode);

  // Critic 规则校验
  currentStep++;
  const critiqueProgress: ProgressEvent = {
    type: 'progress',
    step: currentStep,
    totalSteps,
    message: '检查代码质量...',
  };
  sendEvent(`data: ${JSON.stringify(critiqueProgress)}\n\n`);

  const ruleResult = ruleCheck(accumulatedCode, format);
  const critiqueEvent: CritiqueEvent = {
    type: 'critique',
    passed: ruleResult.passed,
    issues: ruleResult.issues,
  };
  sendEvent(`data: ${JSON.stringify(critiqueEvent)}\n\n`);

  // 如果规则校验失败，尝试 LLM 评审 + 修复
  if (!ruleResult.passed && ruleResult.severity === 'error') {
    currentStep++;
    const repairProgress: ProgressEvent = {
      type: 'progress',
      step: currentStep,
      totalSteps,
      message: '修复问题...',
    };
    sendEvent(`data: ${JSON.stringify(repairProgress)}\n\n`);

    const maxRetries = await configManager.getMaxRetries();
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const critiqueResult = await llmCritique(
          config, userInput, accumulatedCode, format,
          ruleResult.issues, signal,
        );

        if (critiqueResult.fixedCode) {
          const fixedProcessed = strategy.postProcess(critiqueResult.fixedCode);
          accumulatedCode = strategy.optimize(fixedProcessed);
        }

        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (attempt >= maxRetries) break;
      }
    }

    if (lastError) {
      // 修复失败，但不阻断，输出当前最佳结果
      console.error('[MultiPass] 修复失败，输出当前结果:', lastError);
    }
  }

  return accumulatedCode;
}

/** 构建每个步骤的 LLM 消息 */
function buildStepMessages(
  stepType: string,
  stepDescription: string,
  format: DiagramFormat,
  userInput: string,
  contextMessages: LLMMessage[],
  currentCode: string,
  dependencyResults: string[],
): LLMMessage[] {
  const strategy = getStrategy(format);
  const systemPrompt = strategy.getSystemPrompt();

  let stepPrompt = '';
  if (stepType === 'nodes') {
    stepPrompt = `请生成以下节点/形状：\n${stepDescription}`;
  } else if (stepType === 'connections') {
    stepPrompt = `在已有节点的基础上，添加以下连线/关系：\n${stepDescription}`;
  } else if (stepType === 'style') {
    stepPrompt = `对当前代码进行样式优化：\n${stepDescription}`;
  }

  const contextParts: string[] = [];
  if (currentCode) {
    contextParts.push(`当前已生成的代码：\n${currentCode}`);
  }
  if (dependencyResults.length > 0) {
    contextParts.push(`依赖步骤的输出：\n${dependencyResults.join('\n---\n')}`);
  }

  return [
    { role: 'system', content: systemPrompt },
    ...contextMessages.filter(m => m.role !== 'system'),
    {
      role: 'user',
      content: `用户需求：${userInput}\n\n${contextParts.join('\n\n')}\n\n${stepPrompt}\n\n请只输出代码，不要包含解释文字。`,
    },
  ];
}

/** 合并两个代码片段 */
function mergeCode(existing: string, incoming: string, format: DiagramFormat): string {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const strategy = getStrategy(format);

  if (format === 'excalidraw') {
    try {
      const existingArr = JSON.parse(strategy.postProcess(existing));
      const incomingArr = JSON.parse(strategy.postProcess(incoming));
      const existingElements = Array.isArray(existingArr) ? existingArr : (existingArr.elements || []);
      const incomingElements = Array.isArray(incomingArr) ? incomingArr : (incomingArr.elements || []);
      return JSON.stringify([...existingElements, ...incomingElements]);
    } catch {
      return incoming;
    }
  }

  if (format === 'mermaid') {
    // Mermaid：追加代码行（跳过重复的声明行）
    const incomingLines = incoming.split('\n');
    const newLines = incomingLines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !/^(graph|flowchart|sequenceDiagram|classDiagram)/i.test(trimmed);
    });
    return existing + '\n' + newLines.join('\n');
  }

  if (format === 'drawio') {
    // Draw.io：提取 mxCell 追加到现有文件
    const cellRegex = /<mxCell[^>]*\/>/g;
    const incomingCells = incoming.match(cellRegex) || [];
    if (incomingCells.length === 0) return existing;

    const insertPoint = existing.lastIndexOf('</root>');
    if (insertPoint === -1) return existing;

    return existing.slice(0, insertPoint)
      + incomingCells.join('\n  ')
      + '\n' + existing.slice(insertPoint);
  }

  return incoming;
}

/** 获取步骤的用户友好描述 */
function getStepMessage(type: string, description: string): string {
  const shortDesc = description.length > 30 ? description.substring(0, 30) + '...' : description;
  switch (type) {
    case 'nodes': return `生成节点: ${shortDesc}`;
    case 'connections': return `添加连线: ${shortDesc}`;
    case 'style': return `优化样式: ${shortDesc}`;
    default: return shortDesc;
  }
}
