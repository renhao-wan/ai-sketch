import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { getActionSystemPrompt, getActionUserPrompt } from '@/lib/prompts/ai-actions';
import type { AIActionType, DiagramFormat } from '@/lib/prompts/types';
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
      return NextResponse.json({ error: 'Missing required fields: code, format, action' }, { status: 400 });
    }

    // Get LLM config
    let config;
    if (configId) {
      config = await configManager.getConfig(configId);
    } else {
      config = await configManager.getActiveConfig();
    }

    if (!config) {
      return NextResponse.json({ error: 'No LLM config found' }, { status: 400 });
    }

    // Build messages
    const messages = [
      { role: 'system' as const, content: getActionSystemPrompt(action, format) },
      { role: 'user' as const, content: getActionUserPrompt(action, code, format) },
    ];

    // SSE stream
    const encoder = new TextEncoder();
    const timeoutMs = 5 * 60 * 1000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedController = new AbortController();
    request.signal?.addEventListener('abort', () => combinedController.abort());
    timeoutController.signal.addEventListener('abort', () => combinedController.abort());

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await callLLM(config, messages, (chunk) => {
            const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }, combinedController.signal);

          // For non-explain actions, only strip code fences (don't run full postProcess
          // which would repair/restore content the LLM intentionally removed)
          if (action !== 'explain') {
            const cleaned = stripCodeFences(result);
            const finalData = `data: ${JSON.stringify({ type: 'result', content: cleaned })}\n\n`;
            controller.enqueue(encoder.encode(finalData));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          const errorMessage = isAbort ? 'Request timeout' : (error as Error).message;
          const errorData = `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          clearTimeout(timeoutId);
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
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
