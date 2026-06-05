'use client';

import { useState, useCallback, useRef } from 'react';
import { consumeSSEStream } from '@/lib/api/sse-consumer';
import { useLocale } from '@/lib/locales';
import type { LLMConfig, AIActionId } from '@/lib/types';
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
  const [aiActionLoading, setAiActionLoading] = useState<AIActionId | null>(null);
  const [aiExplanation, setAiExplanation] = useState('');

  const handleAIAction = useCallback(async (actionId: AIActionId) => {
    if (!options.generatedCode) {
      options.onNotification(t('aiAction.noCode'), '', 'warning');
      return;
    }

    const controller = new AbortController();
    options.abortControllerRef.current = controller;
    setAiActionLoading(actionId);

    try {
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

      // 使用统一的 consumeSSEStream
      let accumulated = '';
      let finalResult = '';

      const { accumulatedCode } = await consumeSSEStream(
        response.body.getReader(),
        controller.signal,
        {
          onContent: (stripped) => {
            accumulated = stripped;
          },
        },
      );

      // 从累积的代码中提取最终结果
      // 注意：AI action 可能返回 result 类型的事件，需要特殊处理
      // 这里简化处理，直接使用累积的内容
      finalResult = accumulatedCode;

      if (actionId === 'explain') {
        setAiExplanation(accumulatedCode);
        options.onExplanationUpdate(accumulatedCode);
        options.onBottomPanelTabChange('explain');
      } else {
        const codeToApply = finalResult || accumulatedCode;
        options.onCodeUpdate(codeToApply);

        // 验证并应用
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
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('AI action error:', error);
      options.onNotification(t('aiAction.loading'), (error as Error).message, 'error');
    } finally {
      setAiActionLoading(null);
      options.abortControllerRef.current = null;
    }
  }, [options, t]);

  return {
    aiActionLoading,
    aiExplanation,
    handleAIAction,
  };
}
