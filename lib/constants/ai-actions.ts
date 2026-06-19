/**
 * AI 操作相关常量
 * 提取自多个组件中重复的定义
 */

import type { TranslationKey } from '@/lib/locales';

/** 内置操作定义 */
export const BUILTIN_ACTIONS = [
  { id: 'layout', icon: 'LayoutGrid', iconName: 'LayoutGrid', labelKey: 'aiAction.layout' as TranslationKey, actionType: 'modify' as const },
  { id: 'beautify', icon: 'Palette', iconName: 'Palette', labelKey: 'aiAction.beautify' as TranslationKey, actionType: 'modify' as const },
  { id: 'simplify', icon: 'Minimize2', iconName: 'Minimize2', labelKey: 'aiAction.simplify' as TranslationKey, actionType: 'modify' as const },
  { id: 'explain', icon: 'Sparkles', iconName: 'Sparkles', labelKey: 'aiAction.explain' as TranslationKey, actionType: 'explain' as const },
];

/** 内置操作类型映射 */
export const BUILTIN_ACTION_TYPES: Record<string, 'modify' | 'explain'> = {
  'layout': 'modify',
  'beautify': 'modify',
  'simplify': 'modify',
  'explain': 'explain',
};

/** 获取内置操作类型 */
export function getBuiltinActionType(actionId: string): 'modify' | 'explain' {
  return BUILTIN_ACTION_TYPES[actionId] || 'modify';
}

/** 可选图标列表 */
export const ICON_OPTIONS = [
  'Zap', 'Star', 'Heart', 'Coffee', 'Music', 'Camera', 'Code', 'Database',
  'FileText', 'Folder', 'Globe', 'Home', 'Image', 'Lock', 'Mail', 'Map',
  'Mic', 'Moon', 'Phone', 'Pin', 'Search', 'Settings', 'Shield', 'Sun',
  'Terminal', 'User', 'Video', 'Wifi', 'Cloud', 'Download', 'Upload',
  'LayoutGrid', 'Palette', 'Minimize2', 'Sparkles',
] as const;

/** 图标名称类型 */
export type IconName = typeof ICON_OPTIONS[number];
