import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm-client';
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from '@/lib/prompts';
import type { LLMConfig, LLMMessage, ImageData } from '@/types';

/**
 * POST /api/generate
 * Generate Excalidraw code based on user input
 */
export async function POST(request: Request) {
  try {
    const { config, userInput, chartType } = await request.json() as {
      config: LLMConfig;
      userInput: string | { text?: string; image?: ImageData };
      chartType: string;
    };

    if (!config || !userInput) {
      return NextResponse.json(
        { error: 'Missing required parameters: config, userInput' },
        { status: 400 },
      );
    }

    // Build messages array
    let userMessage: LLMMessage;

    // Handle different input types
    if (typeof userInput === 'object' && userInput.image) {
      // Image input with text and image data
      const { text, image } = userInput;
      userMessage = {
        role: 'user',
        content: USER_PROMPT_TEMPLATE(text || '', chartType),
        image: {
          data: image.data,
          mimeType: image.mimeType,
        },
      };
    } else {
      // Regular text input
      userMessage = {
        role: 'user',
        content: USER_PROMPT_TEMPLATE(
          typeof userInput === 'string' ? userInput : (userInput.text || ''),
          chartType,
        ),
      };
    }

    const fullMessages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
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
