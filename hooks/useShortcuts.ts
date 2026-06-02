'use client';

import { useState, useCallback } from 'react';
import type { Shortcut } from '@/types/shortcuts';

/** 默认快捷键定义 */
const DEFAULT_SHORTCUTS: Shortcut[] = [
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
  {
    id: 'send-message',
    keys: ['Ctrl', 'Enter'],
    description: '发送消息',
    descriptionKey: 'shortcuts.sendMessage',
    scope: 'global',
  },
  {
    id: 'undo',
    keys: ['Ctrl', 'Z'],
    description: '撤销',
    descriptionKey: 'shortcuts.undo',
    scope: 'global',
  },
  {
    id: 'redo',
    keys: ['Ctrl', 'Y'],
    description: '重做',
    descriptionKey: 'shortcuts.redo',
    scope: 'global',
  },
  {
    id: 'save',
    keys: ['Ctrl', 'S'],
    description: '保存',
    descriptionKey: 'shortcuts.save',
    scope: 'global',
  },
  {
    id: 'fullscreen',
    keys: ['F11'],
    description: '全屏',
    descriptionKey: 'shortcuts.fullscreen',
    scope: 'global',
  },
];

/** 格式化按键显示 */
export function formatKeys(keys: string[]): string {
  return keys.join(' + ');
}

export function useShortcuts() {
  const [searchQuery, setSearchQuery] = useState('');

  // 搜索快捷键
  const searchShortcuts = useCallback((query: string): Shortcut[] => {
    const lowerQuery = query.toLowerCase();
    return DEFAULT_SHORTCUTS.filter(s =>
      s.description.toLowerCase().includes(lowerQuery) ||
      s.keys.some(k => k.toLowerCase().includes(lowerQuery))
    );
  }, []);

  // 获取过滤后的快捷键
  const filteredShortcuts = searchQuery
    ? searchShortcuts(searchQuery)
    : DEFAULT_SHORTCUTS;

  return {
    shortcuts: DEFAULT_SHORTCUTS,
    filteredShortcuts,
    searchQuery,
    setSearchQuery,
    searchShortcuts,
  };
}
