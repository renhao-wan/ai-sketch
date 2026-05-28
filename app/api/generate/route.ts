import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm-client';
import { configManager } from '@/lib/config-manager';
import { getStrategy } from '@/lib/strategies/registry';
import type { LLMConfig, LLMMessage, ImageData } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

/**
 * POST /api/generate
 * Generate diagram code based on user input and format.
 * Supports two modes:
 *   - { configId, userInput, chartType, format } — server looks up config by ID (secure)
 *   - { config, userInput, chartType, format } — client sends full config (backward compat)
 */
export async function POST(request: Request) {
  try {
    const { configId, config: configBody, userInput, chartType, format } = await request.json() as {
      configId?: string;
      config?: LLMConfig;
      userInput: string | { text?: string; image?: ImageData };
      chartType: string;
      format?: DiagramFormat;
    };

    let config: LLMConfig | undefined;

    if (configId) {
      config = await configManager.getConfig(configId);
      if (!config) {
        return NextResponse.json(
          { error: `配置不存在: ${configId}` },
          { status: 404 },
        );
      }
    } else if (configBody) {
      config = configBody;
    }

    if (!config || !userInput) {
      return NextResponse.json(
        { error: 'Missing required parameters: config/configId, userInput' },
        { status: 400 },
      );
    }

    // Get strategy for the requested format (default to excalidraw for backward compat)
    const diagramFormat: DiagramFormat = format || 'excalidraw';
    const strategy = getStrategy(diagramFormat);

    // Build messages array using strategy
    let userMessage: LLMMessage;

    // Handle different input types
    if (typeof userInput === 'object' && userInput.image) {
      // Image input with text and image data
      const { text, image } = userInput;
      userMessage = {
        role: 'user',
        content: strategy.getUserPrompt(text || '', chartType),
        image: {
          data: image.data,
          mimeType: image.mimeType,
        },
      };
    } else {
      // Regular text input
      userMessage = {
        role: 'user',
        content: strategy.getUserPrompt(
          typeof userInput === 'string' ? userInput : (userInput.text || ''),
          chartType,
        ),
      };
    }

    const fullMessages: LLMMessage[] = [
      { role: 'system', content: strategy.getSystemPrompt() },
      userMessage,
    ];

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await callLLM(config, fullMessages, (chunk) => {
            // Send each chunk as SSE
            const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
          });

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Error in stream:', error);
          const errorData = `data: ${JSON.stringify({ error: (error as Error).message })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
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
    console.error('Error generating code:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to generate code' },
      { status: 500 },
    );
  }
}
