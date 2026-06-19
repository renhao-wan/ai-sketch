import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { getActionSystemPrompt, getActionUserPrompt } from '@/lib/prompts/ai-actions';
import type { AIActionType } from '@/lib/prompts/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import { stripCodeFences } from '@/lib/diagram/json-repair';

interface AIActionRequest {
  code: string;
  format: DiagramFormat;
  action: AIActionType;
  configId?: string;
}

export async function POST(request: Request) {
  try {
    const body: AIActionRequest = await request.json();
    const { code, format, action, configId } = body;

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

    // 构建提示词（仅内置操作）
    const systemPrompt = getActionSystemPrompt(action, format);
    const userPrompt = getActionUserPrompt(action, code, format);
    const isExplainAction = action === 'explain';

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
