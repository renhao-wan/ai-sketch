/**
 * 多轮生成调度器
 * 按 Planner 输出的步骤列表，逐步调用 LLM 生成代码
 */

import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { getStrategy } from '@/lib/strategies/registry';
import { extractFirstJsonObject } from '@/lib/diagram/json-repair';
import type { LLMConfig, LLMMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationPlan } from './types';
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
  let accumulatedCode = '';

  // 按依赖顺序执行步骤
  const stepResults: string[] = [];

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];

    // 构建步骤的 LLM 消息
    const stepMessages = buildStepMessages(
      step.type, step.description, format,
      userInput, contextMessages, accumulatedCode,
      step.dependencies.map(d => {
        if (d < 0 || d >= i || !stepResults[d]) {
          console.warn(`[MultiPass] 步骤 ${i} 的依赖索引 ${d} 无效，跳过`);
          return '';
        }
        return stepResults[d];
      }),
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
      accumulatedCode = await mergeCode(accumulatedCode, processed, format, config, userInput, signal);
    } else {
      // 多个 nodes 步骤：追加合并
      accumulatedCode = await mergeCode(accumulatedCode, processed, format, config, userInput, signal);
    }
  }

  // 最终优化
  accumulatedCode = strategy.optimize(accumulatedCode);

  // Critic 规则校验
  const ruleResult = ruleCheck(accumulatedCode, format);

  // 如果规则校验失败，尝试 LLM 评审 + 修复
  if (!ruleResult.passed && ruleResult.severity === 'error') {
    const maxRetries = await configManager.getMaxRetries();
    let lastError: unknown = null;
    let currentRuleResult = ruleResult;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const critiqueResult = await llmCritique(
          config, userInput, accumulatedCode, format,
          currentRuleResult.issues, signal,
        );

        if (critiqueResult.fixedCode) {
          // 安全边界：限制 fixedCode 大小，防止 LLM 返回异常内容
          const MAX_FIXED_CODE_SIZE = 500000; // 500KB
          if (critiqueResult.fixedCode.length > MAX_FIXED_CODE_SIZE) {
            console.warn(`[MultiPass] LLM 返回的 fixedCode 过大 (${critiqueResult.fixedCode.length} 字符)，跳过修复`);
            break;
          }

          // 安全边界：检查 fixedCode 是否为空或明显无效
          const trimmedFixed = critiqueResult.fixedCode.trim();
          if (!trimmedFixed || trimmedFixed === '[]' || trimmedFixed === '{}') {
            console.warn('[MultiPass] LLM 返回了空的 fixedCode，跳过修复');
            break;
          }

          const fixedProcessed = strategy.postProcess(trimmedFixed);

          // 二次校验：postProcess 后的结果必须通过规则校验
          const preOptimizeCheck = ruleCheck(fixedProcessed, format);
          if (!preOptimizeCheck.passed && preOptimizeCheck.severity === 'error') {
            console.warn('[MultiPass] fixedCode 规则校验未通过，跳过此次修复:', preOptimizeCheck.issues);
            currentRuleResult = preOptimizeCheck;
            if (attempt >= maxRetries) break;
            continue;
          }

          accumulatedCode = strategy.optimize(fixedProcessed);

          // 最终校验
          const reCheck = ruleCheck(accumulatedCode, format);
          if (reCheck.passed || reCheck.severity !== 'error') {
            lastError = null;
            break;
          }
          // 更新 issues 供下次 LLM 参考
          currentRuleResult = reCheck;
          if (attempt >= maxRetries) break;
          continue;
        }
        // LLM 认为无需修复
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

/**
 * 合并两个代码片段（混合策略）
 * 1. 先尝试规则合并（快、省 token）
 * 2. 如果规则合并失败或结果无效，尝试 LLM 合并
 * 3. 如果 LLM 合并也失败，返回 incoming（最后一步的输出）
 */
async function mergeCode(
  existing: string,
  incoming: string,
  format: DiagramFormat,
  config: LLMConfig,
  userInput: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const strategy = getStrategy(format);

  // 第一步：尝试规则合并
  if (strategy.mergeCode) {
    try {
      const ruleMerged = strategy.mergeCode(existing, incoming);

      // 校验规则合并的结果
      const ruleCheckResult = ruleCheck(ruleMerged, format);
      if (ruleCheckResult.passed || ruleCheckResult.severity !== 'error') {
        return ruleMerged;
      }

      console.warn('[MultiPass] 规则合并结果校验未通过，尝试 LLM 合并:', ruleCheckResult.issues);
    } catch (e) {
      console.warn('[MultiPass] 规则合并失败，尝试 LLM 合并:', (e as Error).message);
    }
  }

  // 第二步：尝试 LLM 合并
  try {
    const llmMerged = await llmMergeCode(existing, incoming, format, config, userInput, signal);

    // 校验 LLM 合并的结果
    const llmCheckResult = ruleCheck(llmMerged, format);
    if (llmCheckResult.passed || llmCheckResult.severity !== 'error') {
      return llmMerged;
    }

    console.warn('[MultiPass] LLM 合并结果校验未通过:', llmCheckResult.issues);
  } catch (e) {
    console.warn('[MultiPass] LLM 合并失败:', (e as Error).message);
  }

  // 第三步：兜底方案 - 返回 incoming（最后一步的输出）
  console.warn('[MultiPass] 所有合并方式失败，使用最后一步的输出');
  return incoming;
}

/**
 * 使用 LLM 合并两个代码片段
 */
async function llmMergeCode(
  existing: string,
  incoming: string,
  format: DiagramFormat,
  config: LLMConfig,
  userInput: string,
  signal?: AbortSignal,
): Promise<string> {
  const strategy = getStrategy(format);

  const mergeMessages: LLMMessage[] = [
    {
      role: 'system',
      content: `你是一个图表代码合并专家。你的任务是将两段 ${format} 格式的图表代码合并为一段完整的代码。

合并要求：
1. 保留所有已有的元素和连接
2. 新增的元素和连接要正确整合
3. 处理 ID 冲突（如有重复 ID，重命名新增的元素）
4. 确保合并后的代码语法正确、结构完整
5. 保持代码格式整洁

只输出合并后的完整代码，不要包含解释文字。`,
    },
    {
      role: 'user',
      content: `用户需求：${userInput}

已有代码：
\`\`\`
${existing}
\`\`\`

需要合并的新代码：
\`\`\`
${incoming}
\`\`\`

请输出合并后的完整代码。`,
    },
  ];

  let mergedCode = '';
  await callLLM(config, mergeMessages, (chunk) => {
    mergedCode += chunk;
  }, signal);

  // 后处理
  const processed = strategy.postProcess(mergedCode);
  return strategy.optimize(processed);
}
