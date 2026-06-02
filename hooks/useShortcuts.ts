'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Shortcut, ShortcutConfig, ShortcutScope } from '@/types/shortcuts';

const STORAGE_KEY = 'ai-sketch-shortcuts';

/** 默认全局快捷键定义 */
const DEFAULT_GLOBAL_SHORTCUTS: Shortcut[] = [
  {
    id: 'open-settings',
    keys: ['Ctrl', ','],
    description: '打开设置',
    descriptionKey: 'shortcuts.openSettings',
    scope: 'global',
  },
  {
    id: 'go-home',
    keys: ['Ctrl', 'Shift', 'H'],
    description: '返回首页',
    descriptionKey: 'shortcuts.goHome',
    scope: 'global',
  },
  {
    id: 'new-conversation',
    keys: ['Ctrl', 'Shift', 'N'],
    description: '新建对话',
    descriptionKey: 'shortcuts.newConversation',
    scope: 'global',
  },
  {
    id: 'open-shortcuts-help',
    keys: ['Ctrl', 'Shift', 'K'],
    description: '快捷键帮助',
    descriptionKey: 'shortcuts.openHelp',
    scope: 'global',
  },
  {
    id: 'open-about',
    keys: ['Ctrl', 'Shift', 'A'],
    description: '关于应用',
    descriptionKey: 'shortcuts.openAbout',
    scope: 'global',
  },
  {
    id: 'open-data',
    keys: ['Ctrl', 'Shift', 'D'],
    description: '数据管理',
    descriptionKey: 'shortcuts.openData',
    scope: 'global',
  },
  {
    id: 'open-llm',
    keys: ['Ctrl', 'Shift', 'M'],
    description: 'LLM 配置',
    descriptionKey: 'shortcuts.openLLM',
    scope: 'global',
  },
  {
    id: 'open-conversations',
    keys: ['Ctrl', 'Shift', 'C'],
    description: '会话管理',
    descriptionKey: 'shortcuts.openConversations',
    scope: 'global',
  },
  {
    id: 'open-appearance',
    keys: ['Ctrl', 'Shift', 'O'],
    description: '外观设置',
    descriptionKey: 'shortcuts.openAppearance',
    scope: 'global',
  },
];

/** 默认编辑器快捷键定义（只读展示） */
const DEFAULT_EDITOR_SHORTCUTS: Shortcut[] = [
  { id: 'editor-undo', keys: ['Ctrl', 'Z'], description: '撤销', descriptionKey: 'shortcuts.editorUndo', scope: 'editor' },
  { id: 'editor-redo', keys: ['Ctrl', 'Y'], description: '重做', descriptionKey: 'shortcuts.editorRedo', scope: 'editor' },
  { id: 'editor-save', keys: ['Ctrl', 'S'], description: '保存', descriptionKey: 'shortcuts.editorSave', scope: 'editor' },
  { id: 'editor-fullscreen', keys: ['F11'], description: '全屏', descriptionKey: 'shortcuts.editorFullscreen', scope: 'editor' },
];

/** 格式化按键显示 */
export function formatKeys(keys: string[]): string {
  return keys.join(' + ');
}

/** 检查按键组合是否匹配 */
function matchKeys(event: KeyboardEvent, keys: string[]): boolean {
  const keyMap: Record<string, boolean> = {
    ctrl: event.ctrlKey || event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey,
  };

  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'ctrl' || lowerKey === 'meta') {
      if (!keyMap.ctrl) return false;
    } else if (lowerKey === 'shift') {
      if (!keyMap.shift) return false;
    } else if (lowerKey === 'alt') {
      if (!keyMap.alt) return false;
    } else {
      if (event.key.toLowerCase() !== lowerKey) return false;
    }
  }
  return true;
}

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [configs, setConfigs] = useState<ShortcutConfig[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 加载快捷键配置
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConfigs(parsed);
      } catch {
        setConfigs([]);
      }
    }
  }, []);

  // 初始化快捷键列表
  useEffect(() => {
    const allShortcuts = [...DEFAULT_GLOBAL_SHORTCUTS, ...DEFAULT_EDITOR_SHORTCUTS];
    setShortcuts(allShortcuts);
  }, []);

  // 保存配置
  const saveConfigs = useCallback((newConfigs: ShortcutConfig[]) => {
    setConfigs(newConfigs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfigs));
  }, []);

  // 切换快捷键启用状态
  const toggleShortcut = useCallback((id: string) => {
    setConfigs(prev => {
      const existing = prev.find(c => c.id === id);
      let newConfigs: ShortcutConfig[];
      if (existing) {
        newConfigs = prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c);
      } else {
        newConfigs = [...prev, { id, enabled: false }];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfigs));
      return newConfigs;
    });
  }, []);

  // 重置为默认配置
  const resetShortcuts = useCallback(() => {
    setConfigs([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 检查快捷键是否启用
  const isShortcutEnabled = useCallback((id: string): boolean => {
    const config = configs.find(c => c.id === id);
    return config ? config.enabled : true; // 默认启用
  }, [configs]);

  // 按作用域分组
  const getShortcutsByScope = useCallback((): Record<ShortcutScope, Shortcut[]> => {
    return {
      global: shortcuts.filter(s => s.scope === 'global'),
      editor: shortcuts.filter(s => s.scope === 'editor'),
      settings: shortcuts.filter(s => s.scope === 'settings'),
    };
  }, [shortcuts]);

  // 搜索快捷键
  const searchShortcuts = useCallback((query: string): Shortcut[] => {
    const lowerQuery = query.toLowerCase();
    return shortcuts.filter(s =>
      s.description.toLowerCase().includes(lowerQuery) ||
      s.keys.some(k => k.toLowerCase().includes(lowerQuery))
    );
  }, [shortcuts]);

  // 切换帮助弹窗
  const toggleHelp = useCallback(() => {
    setIsHelpOpen(prev => !prev);
  }, []);

  return {
    shortcuts,
    configs,
    isHelpOpen,
    toggleShortcut,
    resetShortcuts,
    isShortcutEnabled,
    getShortcutsByScope,
    searchShortcuts,
    toggleHelp,
    setIsHelpOpen,
    DEFAULT_GLOBAL_SHORTCUTS,
    DEFAULT_EDITOR_SHORTCUTS,
  };
}
