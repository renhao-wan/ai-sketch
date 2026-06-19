'use client';

import { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Palette,
  Minimize2,
  Sparkles,
  Loader2,
  Zap,
} from 'lucide-react';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';
import type { TranslationKey } from '@/lib/locales';
import type { CanvasAction } from '@/lib/db/custom-action-manager';

// 内置操作定义
const BUILTIN_ACTIONS = [
  { id: 'layout', icon: LayoutGrid, labelKey: 'aiAction.layout' as TranslationKey },
  { id: 'beautify', icon: Palette, labelKey: 'aiAction.beautify' as TranslationKey },
  { id: 'simplify', icon: Minimize2, labelKey: 'aiAction.simplify' as TranslationKey },
  { id: 'explain', icon: Sparkles, labelKey: 'aiAction.explain' as TranslationKey },
];

interface FloatingAIActionsProps {
  onAction?: (actionId: string, customActionId?: string) => void;
  loadingAction?: string | null;
  disabled?: boolean;
}

export default function FloatingAIActions({ onAction, loadingAction, disabled }: FloatingAIActionsProps) {
  const { t } = useLocale();
  const [canvasActions, setCanvasActions] = useState<(CanvasAction & { details?: any })[]>([]);
  const [customActionsMap, setCustomActionsMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  // 加载画布操作
  useEffect(() => {
    loadCanvasActions();
  }, []);

  const loadCanvasActions = async () => {
    try {
      const res = await fetch('/api/canvas-actions');
      const data = await res.json();
      setCanvasActions(data);

      // 构建自定义操作映射
      const map = new Map<string, any>();
      data.forEach((action: any) => {
        if (action.action_type === 'custom' && action.details) {
          map.set(action.action_id, action.details);
        }
      });
      setCustomActionsMap(map);
    } catch (error) {
      console.error('Failed to load canvas actions:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取操作图标
  const getIcon = (action: CanvasAction) => {
    if (action.action_type === 'builtin') {
      const builtin = BUILTIN_ACTIONS.find(b => b.id === action.action_id);
      return builtin?.icon || Zap;
    }
    return Zap;
  };

  // 获取操作标签
  const getLabel = (action: CanvasAction): string => {
    if (action.action_type === 'builtin') {
      const builtin = BUILTIN_ACTIONS.find(b => b.id === action.action_id);
      return builtin ? t(builtin.labelKey) : action.action_id;
    }
    const custom = customActionsMap.get(action.action_id);
    return custom?.name || '自定义操作';
  };

  // 处理点击
  const handleClick = (action: CanvasAction) => {
    if (action.action_type === 'builtin') {
      onAction?.(action.action_id);
    } else {
      onAction?.('custom', action.action_id);
    }
  };

  if (loading) {
    return null;
  }

  // 最多显示 4 个操作
  const visibleActions = canvasActions.slice(0, 4);

  return (
    <div id="onboarding-toolbar" className="absolute right-4 top-1/2 -translate-y-1/2 z-30">
      <div className="flex flex-col gap-2">
        {visibleActions.map((action) => {
          const isLoading = loadingAction === (action.action_type === 'builtin' ? action.action_id : `custom-${action.action_id}`);
          const Icon = isLoading ? Loader2 : getIcon(action);
          const label = getLabel(action);

          return (
            <Tooltip key={`${action.action_type}-${action.action_id}`} content={isLoading ? t('common.loading') : label} side="left">
              <button
                onClick={() => handleClick(action)}
                disabled={disabled || !!loadingAction}
                className={`group relative w-10 h-10 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-[var(--bg-glass)] border border-[var(--border)] shadow-[0_4px_20px_rgba(28,25,23,0.05)] transition-all duration-300 ${
                  isLoading
                    ? 'animate-pulse cursor-wait'
                    : disabled || loadingAction
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-[0_0_30px_rgba(124,58,237,0.12)] hover:bg-[var(--card)] hover:-translate-y-px hover-lift'
                }`}
              >
                <Icon size={17} className={`text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors duration-200 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
