'use client';

import { useState, useCallback, useRef } from 'react';
import { consumeSSEStream } from '@/lib/api/sse-consumer';
import { useLocale } from '@/lib/locales';
import type { LLMConfig } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

interface UseAIActionsOptions {
  config: LLMConfig | null;
  format: DiagramFormat;
  generatedCode: string;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  onCodeUpdate: (code: string) => void;
  onExplanationUpdate: (explanation: string) => void;
  onBottomPanelTabChange: (tab: string) => void;
  onRenderDataUpdate: (data: unknown) => void;
  onJsonErrorUpdate: (error: string | null) => void;
  onNotification: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

/**
 * AI 操作 Hook
 * 管理 AI Action 的执行状态和结果处理
 */
export function useAIActions(options: UseAIActionsOptions) {
  const { t } = useLocale();
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState('');
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 执行内置操作
  const executeBuiltinAction = useCallback(async (actionId: string, controller: AbortController) => {
    const options = optionsRef.current;
    const response = await fetch('/api/ai-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: options.generatedCode,
        format: options.format,
        action: actionId,
        configId: options.config?.id,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI action failed');
    }

    if (!response.body) throw new Error('No response stream');

    let accumulated = '';
    let finalResult = '';

    const { accumulatedCode } = await consumeSSEStream(
      response.body.getReader(),
      controller.signal,
      {
        onContent: (stripped) => {
          accumulated = stripped;
        },
        onResult: (content) => {
          finalResult = content;
        },
      },
    );

    if (actionId === 'explain') {
      setAiExplanation(accumulatedCode);
      options.onExplanationUpdate(accumulatedCode);
      options.onBottomPanelTabChange('explain');
    } else {
      const codeToApply = finalResult || accumulatedCode;
      options.onCodeUpdate(codeToApply);

      const { getStrategy } = await import('@/lib/strategies/registry');
      const strategy = getStrategy(options.format);
      const result = strategy.validate(codeToApply);
      if (result.valid) {
        options.onRenderDataUpdate(result.data);
        options.onJsonErrorUpdate(null);
      } else {
        options.onJsonErrorUpdate(result.error);
      }
    }
  }, []);

  // 执行自定义操作
  const executeCustomAction = useCallback(async (customActionId: string, controller: AbortController) => {
    const options = optionsRef.current;
    const response = await fetch('/api/execute-custom-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: options.generatedCode,
        format: options.format,
        customActionId,
        configId: options.config?.id,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Custom action failed');
    }

    if (!response.body) throw new Error('No response stream');

    let finalResult = '';

    const { accumulatedCode } = await consumeSSEStream(
      response.body.getReader(),
      controller.signal,
      {
        onContent: (stripped) => {
          // 内容累积
        },
        onResult: (content) => {
          finalResult = content;
        },
      },
    );

    // 自定义操作默认为 modify 类型，更新代码
    const codeToApply = finalResult || accumulatedCode;
    options.onCodeUpdate(codeToApply);

    const { getStrategy } = await import('@/lib/strategies/registry');
    const strategy = getStrategy(options.format);
    const result = strategy.validate(codeToApply);
    if (result.valid) {
      options.onRenderDataUpdate(result.data);
      options.onJsonErrorUpdate(null);
    } else {
      options.onJsonErrorUpdate(result.error);
    }
  }, []);

  const handleAIAction = useCallback(async (actionId: string, customActionId?: string) => {
    const options = optionsRef.current;
    if (!options.generatedCode) {
      options.onNotification(t('aiAction.noCode'), '', 'warning');
      return;
    }

    const controller = new AbortController();
    options.abortControllerRef.current = controller;
    const loadingId = customActionId ? `custom-${customActionId}` : actionId;
    setAiActionLoading(loadingId);

    try {
      if (actionId === 'custom' && customActionId) {
        await executeCustomAction(customActionId, controller);
      } else {
        await executeBuiltinAction(actionId, controller);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('AI action error:', error);
      options.onNotification(t('error.title'), (error as Error).message, 'error');
    } finally {
      setAiActionLoading(null);
      options.abortControllerRef.current = null;
    }
  }, [t, executeBuiltinAction, executeCustomAction]);

  return {
    aiActionLoading,
    aiExplanation,
    handleAIAction,
  };
}
