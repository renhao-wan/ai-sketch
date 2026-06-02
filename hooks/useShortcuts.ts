'use client';

import { useState, useCallback } from 'react';
import type { Shortcut } from '@/types/shortcuts';

/** 默认快捷键定义 */
const DEFAULT_SHORTCUTS: Shortcut[] = [
  // 页面导航
  {
    id: 'go-home',
    keys: ['Alt', 'H'],
    description: '返回首页',
    descriptionKey: 'shortcuts.goHome',
    scope: 'global',
  },
  {
    id: 'new-conversation',
    keys: ['Alt', 'N'],
    description: '新建对话',
    descriptionKey: 'shortcuts.newConversation',
    scope: 'global',
  },
  {
    id: 'open-history',
    keys: ['Alt', 'I'],
    description: '历史记录',
    descriptionKey: 'shortcuts.openHistory',
    scope: 'global',
  },
  // 设置页面
  {
    id: 'open-settings',
    keys: ['Alt', 'S'],
    description: '打开设置',
    descriptionKey: 'shortcuts.openSettings',
    scope: 'global',
  },
  {
    id: 'open-appearance',
    keys: ['Alt', 'O'],
    description: '外观设置',
    descriptionKey: 'shortcuts.openAppearance',
    scope: 'global',
  },
  {
    id: 'open-llm',
    keys: ['Alt', 'M'],
    description: 'LLM 配置',
    descriptionKey: 'shortcuts.openLLM',
    scope: 'global',
  },
  {
    id: 'open-conversations',
    keys: ['Alt', 'C'],
    description: '会话管理',
    descriptionKey: 'shortcuts.openConversations',
    scope: 'global',
  },
  {
    id: 'open-data',
    keys: ['Alt', 'D'],
    description: '数据管理',
    descriptionKey: 'shortcuts.openData',
    scope: 'global',
  },
  {
    id: 'open-about',
    keys: ['Alt', 'A'],
    description: '关于应用',
    descriptionKey: 'shortcuts.openAbout',
    scope: 'global',
  },
  // 编辑操作
  {
    id: 'send-message',
    keys: ['Ctrl', 'Enter'],
    description: '发送消息',
    descriptionKey: 'shortcuts.sendMessage',
    scope: 'global',
  },
  {
    id: 'newline',
    keys: ['Shift', 'Enter'],
    description: '换行',
    descriptionKey: 'shortcuts.newline',
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
    id: 'cut',
    keys: ['Ctrl', 'X'],
    description: '剪切',
    descriptionKey: 'shortcuts.cut',
    scope: 'global',
  },
  {
    id: 'copy',
    keys: ['Ctrl', 'C'],
    description: '复制',
    descriptionKey: 'shortcuts.copy',
    scope: 'global',
  },
  {
    id: 'paste',
    keys: ['Ctrl', 'V'],
    description: '粘贴',
    descriptionKey: 'shortcuts.paste',
    scope: 'global',
  },
  {
    id: 'select-all',
    keys: ['Ctrl', 'A'],
    description: '全选',
    descriptionKey: 'shortcuts.selectAll',
    scope: 'global',
  },
  // 其他
  {
    id: 'fullscreen',
    keys: ['F11'],
    description: '全屏',
    descriptionKey: 'shortcuts.fullscreen',
    scope: 'global',
  },
  {
    id: 'escape',
    keys: ['Esc'],
    description: '退出/取消',
    descriptionKey: 'shortcuts.escape',
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
