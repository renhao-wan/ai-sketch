import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { conversationManager } from '@/lib/db/conversation-manager';
import { getStrategy } from '@/lib/strategies/registry';
import type { LLMConfig, LLMMessage, ImageData } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

/**
 * POST /api/generate
 * Generate diagram code based on user input and format.
 * Supports conversation context via optional conversationId.
 *
 * Request body:
 *   { configId?, config?, userInput, chartType, format?, conversationId? }
 *
 * SSE stream events:
 *   data: {"type":"meta","conversationId":"..."}
 *   data: {"type":"content","content":"..."}
 *   ...
 *   data: [DONE]
 */
export async function POST(request: Request) {
  try {
    const { configId, config: configBody, userInput, chartType, format, conversationId, sourceType: frontendSourceType } = await request.json() as {
      configId?: string;
      config?: LLMConfig;
      userInput: string | { text?: string; image?: ImageData; images?: ImageData[] };
      chartType: string;
      format?: DiagramFormat;
      conversationId?: string;
      sourceType?: string;
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

    const diagramFormat: DiagramFormat = format || 'excalidraw';
    const strategy = getStrategy(diagramFormat);

    // ── Conversation management ──
    let activeConversationId = conversationId || null;

    // Create conversation if none exists
    if (!activeConversationId) {
      const userInputText = typeof userInput === 'string' ? userInput : (userInput.text || '');
      const title = userInputText.length > 50 ? userInputText.substring(0, 50) + '...' : userInputText || 'Image Generation';
      const conv = await conversationManager.create({
        title,
        chartType,
        format: diagramFormat,
        configName: config.name || config.type,
        configModel: config.model,
      });
      activeConversationId = conv.id;
    }

    // Normalize image/images into a single array
    const userContent = typeof userInput === 'string' ? userInput : (userInput.text || '');
    const allImages: ImageData[] = [];
    if (typeof userInput === 'object') {
      if (userInput.image) allImages.push(userInput.image);
      if (userInput.images) allImages.push(...userInput.images);
    }
    const sourceType = frontendSourceType || (allImages.length > 0 ? 'image' : 'text');

    // Save user message to conversation (store all images as JSON array for history)
    const imageDataStr = allImages.length > 0
      ? (allImages.length === 1 ? allImages[0].data : JSON.stringify(allImages.map(img => ({ data: img.data, mimeType: img.mimeType }))))
      : undefined;
    const imageMimeTypeStr = allImages.length > 0
      ? (allImages.length === 1 ? allImages[0].mimeType : 'application/json')
      : undefined;
    await conversationManager.addMessage({
      conversationId: activeConversationId,
      role: 'user',
      content: userContent,
      imageData: imageDataStr,
      imageMimeType: imageMimeTypeStr,
      sourceType,
    });

    // ── Build LLM messages with context ──
    const contextMessages = await conversationManager.buildContextMessages(activeConversationId);

    // Build the new user message for LLM
    let newUserMessage: LLMMessage;
    if (allImages.length > 0) {
      newUserMessage = {
        role: 'user',
        content: strategy.getUserPrompt(userContent, chartType),
        images: allImages,
      };
    } else {
      newUserMessage = {
        role: 'user',
        content: strategy.getUserPrompt(
          typeof userInput === 'string' ? userInput : (userInput.text || ''),
          chartType,
        ),
      };
    }

    // Replace the last user message (raw content) with the strategy-formatted version
    if (contextMessages.length > 0 && contextMessages[contextMessages.length - 1].role === 'user') {
      contextMessages[contextMessages.length - 1] = newUserMessage;
    } else {
      contextMessages.push(newUserMessage);
    }

    const fullMessages: LLMMessage[] = [
      { role: 'system', content: strategy.getSystemPrompt() },
      ...contextMessages,
    ];

    // ── SSE stream ──
    const encoder = new TextEncoder();
    let accumulatedCode = '';

    // Combine request signal with a 5-minute timeout
    const timeoutMs = 5 * 60 * 1000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedController = new AbortController();
    request.signal?.addEventListener('abort', () => combinedController.abort());
    timeoutController.signal.addEventListener('abort', () => combinedController.abort());

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send meta event first
          const metaEvent = `data: ${JSON.stringify({ type: 'meta', conversationId: activeConversationId })}\n\n`;
          controller.enqueue(encoder.encode(metaEvent));

          await callLLM(config!, fullMessages, (chunk) => {
            accumulatedCode += chunk;
            const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }, combinedController.signal);

          // Save assistant message after stream completes
          const processedCode = strategy.postProcess(accumulatedCode);
          const optimizedCode = strategy.optimize(processedCode);
          await conversationManager.addMessage({
            conversationId: activeConversationId!,
            role: 'assistant',
            content: optimizedCode,
            sourceType: 'text',
          });
          await conversationManager.updateCurrentCode(activeConversationId!, optimizedCode);

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Error in stream:', error);

          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          const errorMessage = isAbort ? 'Generation cancelled' : (error as Error).message;

          const errorData = `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorData));

          // Save failure marker so conversation state stays consistent
          try {
            await conversationManager.addMessage({
              conversationId: activeConversationId!,
              role: 'assistant',
              content: `[Generation failed: ${errorMessage}]`,
              sourceType: 'text',
            });
          } catch {
            // Ignore secondary failure
          }

          controller.close();
        } finally {
          clearTimeout(timeoutId);
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
