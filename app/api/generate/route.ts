import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';
import { conversationManager } from '@/lib/db/conversation-manager';
import { cacheManager } from '@/lib/db/cache-manager';
import { getStrategy } from '@/lib/strategies/registry';
import type { LLMConfig, LLMMessage, ImageData } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

/** LLM 生成失败时是否值得重试（排除用户主动取消） */
function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  return true;
}

/** 生成失败后清理脏数据：新建会话删除整个会话，已有会话删除刚添加的消息 */
async function cleanupOnFailure(
  conversationId: string | null,
  isNew: boolean,
  isRegenerate: boolean,
): Promise<void> {
  if (!conversationId) return;
  try {
    if (isNew) {
      await conversationManager.delete(conversationId);
    } else if (!isRegenerate) {
      await conversationManager.deleteLastMessage(conversationId);
    }
  } catch (e) {
    console.error('Cleanup after failure failed:', e);
  }
}

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
  const perfMark = (label: string) => console.time(`[Generate] ${label}`);
  const perfEnd = (label: string) => console.timeEnd(`[Generate] ${label}`);

  let activeConversationId: string | null = null;
  let isNewConversation = false;
  let regenerate = false;

  try {
    perfMark('Total');

    perfMark('Parse Request');
    const { configId, config: configBody, userInput, chartType, format, conversationId, sourceType: frontendSourceType, regenerate: regen } = await request.json() as {
      configId?: string;
      config?: LLMConfig;
      userInput: string | { text?: string; image?: ImageData; images?: ImageData[] };
      chartType: string;
      format?: DiagramFormat;
      conversationId?: string;
      sourceType?: string;
      regenerate?: boolean;
    };
    regenerate = regen ?? false;
    activeConversationId = conversationId || null;
    perfEnd('Parse Request');

    let config: LLMConfig | undefined;

    perfMark('Load Config');
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
    perfEnd('Load Config');

    if (!config || !userInput) {
      return NextResponse.json(
        { error: 'Missing required parameters: config/configId, userInput' },
        { status: 400 },
      );
    }

    const diagramFormat: DiagramFormat = format || 'excalidraw';
    const strategy = getStrategy(diagramFormat);

    // ── Conversation management ──
    perfMark('Conversation Management');
    // Create conversation if none exists
    if (!activeConversationId) {
      isNewConversation = true;
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

    if (regenerate) {
      // 重新生成：删除最后一条 assistant 消息，不添加新的 user 消息
      await conversationManager.deleteLastAssistantMessage(activeConversationId!);
    } else {
      // 正常生成：保存 user 消息
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
    }

    // ── Build LLM messages with context ──
    perfMark('Build Context');
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
    perfEnd('Build Context');

    console.log(`[Generate] Messages count: ${fullMessages.length}, System prompt length: ${strategy.getSystemPrompt().length}`);

    // ── 检查缓存（仅对非图片输入、非重新生成、单轮对话生效）──
    // 缓存键包含 prompt + model + format + chartType，确保不同配置不会混淆
    const cacheKey = allImages.length === 0 && !regenerate && contextMessages.length <= 2
      ? `${strategy.getUserPrompt(userContent, chartType)}|${config.model}|${config.name || config.type}`
      : null;
    let cachedResponse: string | null = null;

    if (cacheKey) {
      perfMark('Cache Lookup');
      cachedResponse = await cacheManager.get(cacheKey, diagramFormat, chartType);
      perfEnd('Cache Lookup');

      if (cachedResponse) {
        console.log('[Generate] Cache hit');
      }
    }

    // ── SSE stream ──
    const encoder = new TextEncoder();
    let accumulatedCode = '';
    let isFirstChunk = true;

    // Combine request signal with a 5-minute timeout
    const timeoutMs = 5 * 60 * 1000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedController = new AbortController();
    const onAbort = () => combinedController.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });
    timeoutController.signal.addEventListener('abort', onAbort, { once: true });

    perfEnd('Conversation Management');

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send meta event first
          const metaEvent = `data: ${JSON.stringify({ type: 'meta', conversationId: activeConversationId })}\n\n`;
          controller.enqueue(encoder.encode(metaEvent));

          let optimizedCode: string;

          if (cachedResponse) {
            // 使用缓存的响应（已经是处理过的最终代码）
            optimizedCode = cachedResponse;

            // 模拟流式输出（分块发送）
            const chunkSize = 50;
            for (let i = 0; i < optimizedCode.length; i += chunkSize) {
              const chunk = optimizedCode.substring(i, i + chunkSize);
              const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          } else {
            // 获取全局重试配置
            const maxRetries = await configManager.getMaxRetries();
            let lastError: unknown = null;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
              try {
                // 重试时重置状态
                if (attempt > 0) {
                  console.log(`[Generate] 重试第 ${attempt} 次（共 ${maxRetries} 次重试）`);
                  accumulatedCode = '';
                  isFirstChunk = true;
                  // 通知客户端正在重试
                  const retryEvent = `data: ${JSON.stringify({ type: 'retry', attempt, maxRetries })}\n\n`;
                  controller.enqueue(encoder.encode(retryEvent));
                }

                // 调用 LLM
                perfMark('LLM Call (First Token)');
                await callLLM(config!, fullMessages, (chunk) => {
                  if (isFirstChunk) {
                    perfEnd('LLM Call (First Token)');
                    perfMark('LLM Streaming');
                    isFirstChunk = false;
                  }
                  accumulatedCode += chunk;
                  const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }, combinedController.signal);

                if (!isFirstChunk) {
                  perfEnd('LLM Streaming');
                }

                // 成功则跳出重试循环
                lastError = null;
                break;
              } catch (err) {
                lastError = err;
                console.error(`[Generate] LLM 调用失败 (attempt ${attempt + 1}/${maxRetries + 1}):`, err);
                // 不可重试的错误（如用户取消）或已用完重试次数，直接跳出
                if (!isRetryableError(err) || attempt >= maxRetries) break;
              }
            }

            // 如果所有重试都失败了，抛出最后一个错误
            if (lastError) throw lastError;

            perfMark('Post Process');
            // 处理 LLM 响应
            const processedCode = strategy.postProcess(accumulatedCode);
            optimizedCode = strategy.optimize(processedCode);

            // 保存到缓存（如果有缓存 key）
            if (cacheKey) {
              await cacheManager.set(cacheKey, diagramFormat, chartType, optimizedCode);
            }
            perfEnd('Post Process');
          }

          // Save assistant message
          await conversationManager.addMessage({
            conversationId: activeConversationId!,
            role: 'assistant',
            content: optimizedCode,
            sourceType: 'text',
          });
          await conversationManager.updateCurrentCode(activeConversationId!, optimizedCode);

          perfEnd('Total');

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Error in stream:', error);

          await cleanupOnFailure(activeConversationId, isNewConversation, regenerate);

          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          const errorMessage = isAbort
            ? 'Generation cancelled'
            : (process.env.NODE_ENV === 'development' ? (error as Error).message : '生成失败，请稍后重试');

          const errorData = `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorData));

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

    await cleanupOnFailure(activeConversationId, isNewConversation, regenerate);

    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : '生成失败，请稍后重试' },
      { status: 500 },
    );
  }
}
