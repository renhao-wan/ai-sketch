import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { customActionManager } from '@/lib/db/custom-action-manager';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import { stripCodeFences } from '@/lib/diagram/json-repair';

interface CustomActionRequest {
  code: string;
  format: DiagramFormat;
  customActionId: string;
  configId?: string;
}

/**
 * 构建自定义操作的系统提示词
 */
function getCustomActionSystemPrompt(actionType: string, format: DiagramFormat): string {
  const formatName = format === 'excalidraw' ? 'Excalidraw' : format === 'mermaid' ? 'Mermaid' : 'Draw.io';

  if (actionType === 'explain') {
    return `你是一个专业的图表分析助手。请分析用户提供的 ${formatName} 图表代码，并给出清晰的解释。使用中文回答。`;
  }

  return `你是一个专业的图表修改助手。请根据用户的要求修改 ${formatName} 图表代码。
规则：
1. 只返回修改后的代码，不要添加任何解释
2. 保持原有的图表格式不变
3. 确保修改后的代码格式正确、可解析
4. 如果无法完成修改，返回原始代码`;
}

/**
 * 构建自定义操作的用户提示词
 */
function getCustomActionUserPrompt(prompt: string, code: string, format: DiagramFormat): string {
  return `${prompt}

当前图表代码：
\`\`\`${format}
${code}
\`\`\``;
}

export async function POST(request: Request) {
  try {
    const body: CustomActionRequest = await request.json();
    const { code, format, customActionId, configId } = body;

    if (!code || !format || !customActionId) {
      return NextResponse.json({ error: '缺少必要参数: code, format, customActionId' }, { status: 400 });
    }

    // 获取自定义操作详情
    const customAction = await customActionManager.getById(customActionId);
    if (!customAction) {
      return NextResponse.json({ error: '自定义操作不存在' }, { status: 404 });
    }

    if (!customAction.enabled) {
      return NextResponse.json({ error: '该自定义操作已禁用' }, { status: 400 });
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

    // 构建消息
    const messages = [
      { role: 'system' as const, content: getCustomActionSystemPrompt(customAction.action_type, format) },
      { role: 'user' as const, content: getCustomActionUserPrompt(customAction.prompt, code, format) },
    ];

    // SSE 流
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

          // 对于非 explain 类型的操作，去除代码围栏
          if (customAction.action_type !== 'explain') {
            const cleaned = stripCodeFences(result);
            const finalData = `data: ${JSON.stringify({ type: 'result', content: cleaned })}\n\n`;
            controller.enqueue(encoder.encode(finalData));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          const errorMessage = isAbort
            ? 'Request timeout'
            : (process.env.NODE_ENV === 'development' ? (error as Error).message : '自定义操作执行失败，请稍后重试');
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
    console.error('Custom action error:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : '自定义操作执行失败，请稍后重试' },
      { status: 500 },
    );
  }
}
