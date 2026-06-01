// types/shortcuts.ts

/** 快捷键作用域 */
export type ShortcutScope = 'global' | 'editor' | 'settings';

/** 快捷键定义 */
export interface Shortcut {
  id: string;
  keys: string[];
  description: string;
  descriptionKey: string;
  scope: ShortcutScope;
  action?: () => void;
}

/** 快捷键配置 */
export interface ShortcutConfig {
  id: string;
  enabled: boolean;
  customKeys?: string[];
}

/** 快捷键分类 */
export interface ShortcutCategory {
  scope: ShortcutScope;
  labelKey: string;
  shortcuts: Shortcut[];
}
