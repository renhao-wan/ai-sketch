'use client';

import { useState, useCallback, useRef } from 'react';
import { consumeSSEStream } from '@/lib/api/sse-consumer';
import { useLocale } from '@/lib/locales';
import type { LLMConfig } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { DynamicTab } from '@/components/layout/BottomContextPanel';

interface UseAIActionsOptions {
  config: LLMConfig | null;
  format: DiagramFormat;
  generatedCode: string;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  onCodeUpdate: (code: string) => void;
  onDynamicTabAdd: (tab: DynamicTab) => void;
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

    // 获取操作信息
    const actionInfo = getBuiltinActionInfo(actionId);

    if (actionInfo.type === 'explain') {
      // 解释类型：添加动态 tab（使用 action- 前缀）
      const newTab: DynamicTab = {
        id: `action-${actionId}`,
        label: actionInfo.label,
        icon: actionInfo.icon,
        content: accumulatedCode,
        type: 'text',
        timestamp: Date.now(),
      };
      options.onDynamicTabAdd(newTab);
    } else {
      // 修改类型：更新代码
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
        onContent: () => {
          // 内容由 accumulatedCode 自动累积
        },
        onResult: (content) => {
          finalResult = content;
        },
      },
    );

    // 获取自定义操作信息
    const customAction = await getCustomActionInfo(customActionId);

    if (customAction.action_type === 'explain') {
      // 解释类型：添加动态 tab（使用 action- 前缀）
      const newTab: DynamicTab = {
        id: `action-${customActionId}`,
        label: customAction.name,
        icon: customAction.icon,
        content: accumulatedCode,
        type: 'text',
        timestamp: Date.now(),
      };
      options.onDynamicTabAdd(newTab);
    } else {
      // 修改类型：更新代码
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
    handleAIAction,
  };
}

// 获取内置操作信息
function getBuiltinActionInfo(actionId: string) {
  const actions: Record<string, { label: string; icon: string; type: 'modify' | 'explain' }> = {
    'layout': { label: '布局优化', icon: 'LayoutGrid', type: 'modify' },
    'beautify': { label: '美化', icon: 'Palette', type: 'modify' },
    'simplify': { label: '简化', icon: 'Minimize2', type: 'modify' },
    'explain': { label: 'AI 解释', icon: 'Sparkles', type: 'explain' },
  };
  return actions[actionId] || { label: actionId, icon: 'Zap', type: 'modify' };
}

// 获取自定义操作信息
async function getCustomActionInfo(customActionId: string) {
  try {
    const response = await fetch(`/api/custom-actions/${customActionId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch custom action');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get custom action info:', error);
    return { name: '自定义操作', icon: 'Zap', action_type: 'modify' };
  }
}
