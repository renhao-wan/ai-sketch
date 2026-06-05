'use client';

import { useState, useCallback, useRef } from 'react';
import { getStrategy } from '@/lib/strategies/registry';
import { consumeSSEStream } from '@/lib/api/sse-consumer';
import { isConfigValid } from '@/lib/api/config-validator';
import { generateId, parseStoredImages } from '@/lib/utils';
import { useLocale, type TranslationKey } from '@/lib/locales';
import type { LLMConfig, ConversationMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { StreamRendererRef } from '@/components/canvases/ExcalidrawCanvas';

interface UseGenerationOptions {
  config: LLMConfig | null;
  format: DiagramFormat;
  conversationId: string | null;
  streamRendererRef: React.MutableRefObject<StreamRendererRef | null>;
  onCodeUpdate: (code: string) => void;
  onRenderDataUpdate: (data: unknown) => void;
  onJsonErrorUpdate: (error: string | null) => void;
  onConversationIdUpdate: (id: string | null) => void;
  onMessagesUpdate: (updater: (prev: ConversationMessage[]) => ConversationMessage[]) => void;
  onConfigReminder: () => void;
  onChartTypeUpdate?: (chartType: string) => void;
}

/**
 * HTTP 错误处理
 */
function parseHttpError(response: Response, t: (key: TranslationKey) => string): string {
  switch (response.status) {
    case 400: return t('editor.requestError');
    case 401: case 403: return t('editor.apiKeyError');
    case 429: return t('editor.rateLimit');
    case 500: case 502: case 503: return t('editor.serverError');
    default: return `${t('editor.requestFailed')} (${response.status})`;
  }
}

/**
 * 流处理结果
 */
interface StreamResult {
  accumulatedCode: string;
  activeConvId: string | null;
}

/**
 * 消费 SSE 流并处理响应
 */
async function consumeStream(
  response: Response,
  signal: AbortSignal,
  callbacks: {
    onMeta?: (convId: string) => void;
    onContent: (code: string) => void;
    onRetry?: () => void;
  },
  t: (key: TranslationKey) => string,
): Promise<StreamResult> {
  if (!response.ok) {
    let errorMessage = t('editor.generateFailed');
    try {
      const errorData = await response.json();
      if (errorData.error) errorMessage = errorData.error;
    } catch {
      errorMessage = parseHttpError(response, t);
    }
    throw new Error(errorMessage);
  }

  if (!response.body) throw new Error('Response body is null');

  let activeConvId: string | null = null;
  const { accumulatedCode } = await consumeSSEStream(
    response.body.getReader(),
    signal,
    {
      onMeta: (convId) => {
        activeConvId = convId;
        callbacks.onMeta?.(convId);
      },
      onContent: callbacks.onContent,
      onRetry: callbacks.onRetry,
    },
  );

  return { accumulatedCode, activeConvId };
}

/**
 * 后处理代码
 */
function postProcessCode(code: string, format: DiagramFormat): string {
  const strategy = getStrategy(format);
  const processed = strategy.postProcess(code);
  return strategy.optimize(processed);
}

/**
 * 代码生成 Hook
 * 管理生成状态、流式处理、代码后处理
 */
export function useGeneration(options: UseGenerationOptions) {
  const { t } = useLocale();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);

  // 同步 isStreaming 到 ref
  const updateIsStreaming = useCallback((value: boolean) => {
    setIsStreaming(value);
    isStreamingRef.current = value;
  }, []);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
    updateIsStreaming(false);
  }, [updateIsStreaming]);

  /**
   * 通用的生成请求处理
   */
  const executeGeneration = useCallback(async (params: {
    userInput: string | { text?: string; images?: unknown[] };
    chartType: string;
    sourceType: string;
    regenerate?: boolean;
    optimisticUserMsg?: ConversationMessage;
    optimisticAssistantMsg: ConversationMessage;
  }): Promise<void> => {
    const {
      userInput,
      chartType,
      sourceType,
      regenerate = false,
      optimisticUserMsg,
      optimisticAssistantMsg,
    } = params;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    updateIsStreaming(true);
    setApiError(null);
    options.onJsonErrorUpdate(null);

    // 记录请求前的 conversationId，用于失败时回滚（新建会话失败后服务端会删除该会话）
    const previousConversationId = options.conversationId;

    const sendTime = performance.now();
    let firstContentTime: number | null = null;

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: options.config!.id,
          userInput,
          chartType,
          format: options.format,
          conversationId: options.conversationId,
          sourceType,
          regenerate,
        }),
        signal: controller.signal,
      });

      console.log(`[Generation] Response received in ${Math.round(performance.now() - sendTime)}ms`);

      const { accumulatedCode, activeConvId } = await consumeStream(
        response,
        controller.signal,
        {
          onMeta: (convId) => {
            options.onConversationIdUpdate(convId);
            if (optimisticUserMsg) {
              options.onMessagesUpdate(prev => prev.map(m =>
                (m.id === optimisticUserMsg.id || m.id === optimisticAssistantMsg.id)
                  ? { ...m, conversationId: convId }
                  : m
              ));
            }
          },
          onContent: (stripped) => {
            if (!firstContentTime) {
              firstContentTime = performance.now();
              console.log(`[Generation] First content in ${Math.round(firstContentTime - sendTime)}ms`);
            }
            options.onCodeUpdate(stripped);
            options.streamRendererRef.current?.feed(stripped);
            options.onMessagesUpdate(prev => prev.map(m =>
              m.id === optimisticAssistantMsg.id ? { ...m, content: stripped } : m
            ));
          },
          onRetry: () => {
            // 重试时清空画布和已累积的代码，准备接收新内容
            options.onCodeUpdate('');
            options.streamRendererRef.current?.reset();
            options.onMessagesUpdate(prev => prev.map(m =>
              m.id === optimisticAssistantMsg.id ? { ...m, content: '' } : m
            ));
          },
        },
        t,
      );

      console.log(`[Generation] Stream completed in ${Math.round(performance.now() - sendTime)}ms`);

      // 后处理
      const optimizedCode = postProcessCode(accumulatedCode, options.format);
      options.onCodeUpdate(optimizedCode);
      options.streamRendererRef.current?.reset();

      // 验证并应用
      const strategy = getStrategy(options.format);
      const result = strategy.validate(optimizedCode);
      if (result.valid) {
        options.onRenderDataUpdate(result.data);
        options.onJsonErrorUpdate(null);
      } else {
        options.onJsonErrorUpdate(result.error);
      }

      // 更新消息
      options.onMessagesUpdate(prev => prev.map(m =>
        m.id === optimisticAssistantMsg.id
          ? { ...m, content: optimizedCode, conversationId: activeConvId || m.conversationId }
          : m
      ));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[Generation] Error:', error);

      // 新建会话失败时，服务端已删除该会话，回滚客户端的 conversationId
      if (previousConversationId === null) {
        options.onConversationIdUpdate(null);
      }

      setApiError(
        error instanceof TypeError || (error as Error).message === 'Failed to fetch'
          ? t('editor.networkError')
          : (error as Error).message
      );
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
      updateIsStreaming(false);
    }
  }, [options, t, updateIsStreaming]);

  /**
   * 发送新消息
   */
  const sendMessage = useCallback(async (
    userMessage: string | { text?: string; images?: unknown[] },
    chartType: string = 'auto',
    sourceType: string = 'text',
  ) => {
    if (isGenerating) return;

    if (!isConfigValid(options.config)) {
      options.onConfigReminder();
      return;
    }

    // 更新图表类型状态
    options.onChartTypeUpdate?.(chartType);

    const userContent = typeof userMessage === 'string' ? userMessage : (userMessage.text || '');

    // 创建乐观消息
    const optimisticUserMsg: ConversationMessage = {
      id: generateId(),
      conversationId: options.conversationId || '',
      role: 'user',
      content: userContent,
      sourceType: sourceType as 'text' | 'file' | 'image',
      createdAt: Date.now(),
      ...(sourceType === 'image' && typeof userMessage === 'object' && userMessage.images?.length ? {
        imageData: (userMessage.images[0] as { data?: string })?.data,
        imageMimeType: (userMessage.images[0] as { mimeType?: string })?.mimeType,
      } : {}),
    };

    const optimisticAssistantMsg: ConversationMessage = {
      id: generateId(),
      conversationId: options.conversationId || '',
      role: 'assistant',
      content: '',
      sourceType: 'text',
      createdAt: Date.now(),
    };

    options.onMessagesUpdate(prev => [...prev, optimisticUserMsg, optimisticAssistantMsg]);

    await executeGeneration({
      userInput: userMessage,
      chartType,
      sourceType,
      optimisticUserMsg,
      optimisticAssistantMsg,
    });
  }, [isGenerating, options, executeGeneration]);

  /**
   * 重新生成
   */
  const regenerate = useCallback(async (messages: ConversationMessage[], chartType: string = 'auto') => {
    if (isGenerating || messages.length === 0) return;

    if (!isConfigValid(options.config)) {
      options.onConfigReminder();
      return;
    }

    // 找到最后一条 user 消息
    const lastUserIdx = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return;
    const lastUserMsg = messages[messages.length - 1 - lastUserIdx];

    // 从 user 消息中还原 images
    const images = parseStoredImages(lastUserMsg.imageData, lastUserMsg.imageMimeType);
    const userInput = images.length > 0
      ? { text: lastUserMsg.content, images }
      : lastUserMsg.content;

    // 删除旧的 assistant 消息
    options.onMessagesUpdate(prev => {
      const lastAssistantIdx = [...prev].reverse().findIndex(m => m.role === 'assistant');
      if (lastAssistantIdx === -1) return prev;
      const idx = prev.length - 1 - lastAssistantIdx;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });

    // 添加新的 assistant 占位
    const optimisticAssistantMsg: ConversationMessage = {
      id: generateId(),
      conversationId: options.conversationId || '',
      role: 'assistant',
      content: '',
      sourceType: 'text',
      createdAt: Date.now(),
    };
    options.onMessagesUpdate(prev => [...prev, optimisticAssistantMsg]);

    await executeGeneration({
      userInput,
      chartType,
      sourceType: lastUserMsg.sourceType || 'text',
      regenerate: true,
      optimisticAssistantMsg,
    });
  }, [isGenerating, options, executeGeneration]);

  return {
    isGenerating,
    isStreaming,
    apiError,
    setApiError,
    cancelGeneration,
    sendMessage,
    regenerate,
    abortControllerRef,
    isStreamingRef,
  };
}
