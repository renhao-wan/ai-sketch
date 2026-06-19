'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LayoutGrid,
  Palette,
  Minimize2,
  Sparkles,
  Loader2,
  Zap,
  Star,
  Heart,
  Coffee,
  Music,
  Camera,
  Code,
  Database,
  FileText,
  Folder,
  Globe,
  Home,
  Image,
  Lock,
  Mail,
  Map as MapIcon,
  Mic,
  Moon,
  Phone,
  Pin,
  Search,
  Settings,
  Shield,
  Sun,
  Terminal,
  User,
  Video,
  Wifi,
  Cloud,
  Download,
  Upload,
} from 'lucide-react';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';
import type { TranslationKey } from '@/lib/locales';
import type { CanvasAction } from '@/lib/db/custom-action-manager';
import { BUILTIN_ACTIONS, getBuiltinActionType } from '@/lib/constants/ai-actions';

// 图标映射
const ICON_MAP: Record<string, typeof Zap> = {
  LayoutGrid, Palette, Minimize2, Sparkles, Zap, Star, Heart, Coffee, Music, Camera, Code, Database, FileText, Folder, Globe, Home, Image, Lock, Mail, Map: MapIcon, Mic, Moon, Phone, Pin, Search, Settings, Shield, Sun, Terminal, User, Video, Wifi, Cloud, Download, Upload,
};

// 获取图标组件
const getIconComponent = (iconName: string) => {
  return ICON_MAP[iconName] || Zap;
};

// 操作信息接口
export interface ActionInfo {
  id: string;
  label: string;
  icon: string;
  type: 'builtin' | 'custom';
  actionType: 'modify' | 'explain';
}

interface FloatingAIActionsProps {
  onAction?: (actionId: string, customActionId?: string) => void;
  onActionsLoad?: (actions: ActionInfo[]) => void;
  loadingAction?: string | null;
  disabled?: boolean;
}

export default function FloatingAIActions({ onAction, onActionsLoad, loadingAction, disabled }: FloatingAIActionsProps) {
  const { t } = useLocale();
  const [canvasActions, setCanvasActions] = useState<(CanvasAction & { details?: any })[]>([]);
  const [customActionsMap, setCustomActionsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const loadCanvasActions = useCallback(async () => {
    try {
      const res = await fetch('/api/canvas-actions');
      const data = await res.json();
      setCanvasActions(data);

      // 构建自定义操作映射
      const map: Record<string, any> = {};
      data.forEach((action: any) => {
        if (action.action_type === 'custom' && action.details) {
          map[action.action_id] = action.details;
        }
      });
      setCustomActionsMap(map);

      // 通知编辑器页面可用的操作列表
      const actionInfos: ActionInfo[] = data.map((action: any) => {
        if (action.action_type === 'builtin') {
          const builtin = BUILTIN_ACTIONS.find(b => b.id === action.action_id);
          return {
            id: action.action_id,
            label: builtin ? t(builtin.labelKey) : action.action_id,
            icon: builtin?.iconName || 'Zap',
            type: 'builtin' as const,
            actionType: getBuiltinActionType(action.action_id),
          };
        } else {
          const custom = map[action.action_id];
          return {
            id: action.action_id,
            label: custom?.name || t('aiActions.customFallback'),
            icon: custom?.icon || 'Zap',
            type: 'custom' as const,
            actionType: custom?.action_type || 'modify',
          };
        }
      });
      onActionsLoad?.(actionInfos);
    } catch (error) {
      console.error('Failed to load canvas actions:', error);
    } finally {
      setLoading(false);
    }
  }, [t, onActionsLoad]);

  // 加载画布操作
  useEffect(() => {
    loadCanvasActions();
  }, [loadCanvasActions]);

  // 获取操作图标
  const getIcon = (action: CanvasAction) => {
    if (action.action_type === 'builtin') {
      const builtin = BUILTIN_ACTIONS.find(b => b.id === action.action_id);
      return getIconComponent(builtin?.icon || 'Zap');
    }
    const custom = customActionsMap[action.action_id];
    return getIconComponent(custom?.icon || 'Zap');
  };

  // 获取操作标签
  const getLabel = (action: CanvasAction): string => {
    if (action.action_type === 'builtin') {
      const builtin = BUILTIN_ACTIONS.find(b => b.id === action.action_id);
      return builtin ? t(builtin.labelKey) : action.action_id;
    }
    const custom = customActionsMap[action.action_id];
    return custom?.name || t('aiActions.customFallback');
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
