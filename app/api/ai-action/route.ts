import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { customActionManager } from '@/lib/db/custom-action-manager';
import { getActionSystemPrompt, getActionUserPrompt } from '@/lib/prompts/ai-actions';
import type { AIActionType } from '@/lib/prompts/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import { stripCodeFences } from '@/lib/diagram/json-repair';

// 系统提示词模板
const MODIFY_SYSTEM_PROMPT = `你是图表代码优化专家。用户会提供图表代码和优化要求。

【强制规则】
1. 必须输出完整的图表代码
2. 禁止输出任何解释、说明或注释
3. 禁止使用 markdown 代码块包裹
4. 必须保持与输入相同的代码格式
5. 直接输出修改后的代码，不要添加任何前缀文字

违反以上规则将导致系统错误。`;

const EXPLAIN_SYSTEM_PROMPT = `你是图表分析专家。用户会提供图表代码和分析要求。

【强制规则】
1. 必须输出详细的文字说明
2. 禁止输出任何代码
3. 必须使用 Markdown 格式
4. 必须包含图表结构分析、节点说明、流程描述
5. 使用清晰的中文描述

违反以上规则将导致系统错误。`;

interface AIActionRequest {
  code: string;
  format: DiagramFormat;
  action: AIActionType | 'custom';
  actionId?: string;
  configId?: string;
}

export async function POST(request: Request) {
  try {
    const body: AIActionRequest = await request.json();
    const { code, format, action, actionId, configId } = body;

    if (!code || !format || !action) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 获取 LLM 配置
    let config;
    if (configId) {
      config = await configManager.getConfig(configId);
    } else {
      config = await configManager.getActiveConfig();
    }

    if (!config) {
      return NextResponse.json({ error: '未找到 LLM 配置' }, { status: 400 });
    }

    // 构建提示词
    let systemPrompt: string;
    let userPrompt: string;
    let isExplainAction = action === 'explain';

    if (action === 'custom' && actionId) {
      // 自定义操作
      const customAction = await customActionManager.getById(actionId);
      if (!customAction) {
        return NextResponse.json({ error: '自定义操作不存在' }, { status: 404 });
      }

      systemPrompt = customAction.action_type === 'modify' ? MODIFY_SYSTEM_PROMPT : EXPLAIN_SYSTEM_PROMPT;
      userPrompt = `${customAction.prompt}\n\n当前图表代码：\n${code}`;
      isExplainAction = customAction.action_type === 'explain';
    } else {
      // 内置操作
      systemPrompt = getActionSystemPrompt(action, format);
      userPrompt = getActionUserPrompt(action, code, format);
    }

    // 构建消息
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    // SSE 流式响应
    const encoder = new TextEncoder();
    const timeoutMs = 5 * 60 * 1000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedController = new AbortController();
    const onAbort = () => combinedController.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });
    timeoutController.signal.addEventListener('abort', onAbort, { once: true });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await callLLM(config, messages, (chunk) => {
            const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }, combinedController.signal);

          // 对于非 explain 操作，去除代码围栏
          if (!isExplainAction) {
            const cleaned = stripCodeFences(result);
            const finalData = `data: ${JSON.stringify({ type: 'result', content: cleaned })}\n\n`;
            controller.enqueue(encoder.encode(finalData));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          const errorMessage = isAbort
            ? 'Request timeout'
            : (process.env.NODE_ENV === 'development' ? (error as Error).message : 'AI 操作失败，请稍后重试');
          const errorData = `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          clearTimeout(timeoutId);
          request.signal?.removeEventListener('abort', onAbort);
          timeoutController.signal.removeEventListener('abort', onAbort);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI action error:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'AI 操作失败，请稍后重试' },
      { status: 500 },
    );
  }
}
