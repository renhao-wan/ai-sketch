'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Shortcut } from '@/lib/types/shortcuts';

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
    id: 'open-tags',
    keys: ['Alt', 'T'],
    description: '标签管理',
    descriptionKey: 'shortcuts.openTags',
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
    id: 'open-shortcuts',
    keys: ['Alt', 'B'],
    description: '快捷键设置',
    descriptionKey: 'shortcuts.openShortcuts',
    scope: 'global',
  },
  {
    id: 'open-network',
    keys: ['Alt', 'K'],
    description: '网络设置',
    descriptionKey: 'shortcuts.openNetwork',
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
  // 格式切换
  {
    id: 'switch-excalidraw',
    keys: ['Alt', '1'],
    description: '切换到 Excalidraw',
    descriptionKey: 'shortcuts.switchExcalidraw',
    scope: 'editor',
  },
  {
    id: 'switch-mermaid',
    keys: ['Alt', '2'],
    description: '切换到 Mermaid',
    descriptionKey: 'shortcuts.switchMermaid',
    scope: 'editor',
  },
  {
    id: 'switch-drawio',
    keys: ['Alt', '3'],
    description: '切换到 Draw.io',
    descriptionKey: 'shortcuts.switchDrawio',
    scope: 'editor',
  },
  // 窗口控制
  {
    id: 'window-minimize',
    keys: ['Alt', 'F9'],
    description: '最小化窗口',
    descriptionKey: 'shortcuts.windowMinimize',
    scope: 'global',
  },
  {
    id: 'window-maximize',
    keys: ['Alt', 'F10'],
    description: '最大化/还原窗口',
    descriptionKey: 'shortcuts.windowMaximize',
    scope: 'global',
  },
  {
    id: 'window-close',
    keys: ['Alt', 'F4'],
    description: '关闭窗口',
    descriptionKey: 'shortcuts.windowClose',
    scope: 'global',
  },
];

/** 格式化按键显示 */
export function formatKeys(keys: string[]): string {
  return keys.join(' + ');
}

/** 检查按键组合是否匹配 */
function matchKeys(event: KeyboardEvent, keys: string[]): boolean {
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'ctrl' || lowerKey === 'meta') {
      if (!event.ctrlKey && !event.metaKey) return false;
    } else if (lowerKey === 'shift') {
      if (!event.shiftKey) return false;
    } else if (lowerKey === 'alt') {
      if (!event.altKey) return false;
    } else {
      if (event.key.toLowerCase() !== lowerKey) return false;
    }
  }
  return true;
}

/** 快捷键动作回调类型 */
interface ShortcutActions {
  onGoHome?: () => void;
  onNewConversation?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onSwitchFormat?: (format: 'excalidraw' | 'mermaid' | 'drawio') => void;
}

export function useShortcuts(actions?: ShortcutActions) {
  const [searchQuery, setSearchQuery] = useState('');

  // 注册全局快捷键
  useEffect(() => {
    if (!actions) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 忽略在输入框中的快捷键（除了 Alt 组合键）
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Alt 组合键在任何地方都生效
      if (event.altKey) {
        // 页面导航
        if (matchKeys(event, ['Alt', 'H'])) {
          event.preventDefault();
          actions.onGoHome?.();
          return;
        }
        if (matchKeys(event, ['Alt', 'N'])) {
          event.preventDefault();
          actions.onNewConversation?.();
          return;
        }
        if (matchKeys(event, ['Alt', 'I'])) {
          event.preventDefault();
          actions.onOpenHistory?.();
          return;
        }
        // 设置页面
        if (matchKeys(event, ['Alt', 'S'])) {
          event.preventDefault();
          actions.onOpenSettings?.();
          return;
        }
        if (matchKeys(event, ['Alt', 'O'])) {
          event.preventDefault();
          actions.onOpenSettings?.('appearance');
          return;
        }
        if (matchKeys(event, ['Alt', 'M'])) {
          event.preventDefault();
          actions.onOpenSettings?.('llm');
          return;
        }
        if (matchKeys(event, ['Alt', 'K'])) {
          event.preventDefault();
          actions.onOpenSettings?.('network');
          return;
        }
        if (matchKeys(event, ['Alt', 'C'])) {
          event.preventDefault();
          actions.onOpenSettings?.('conversations');
          return;
        }
        if (matchKeys(event, ['Alt', 'T'])) {
          event.preventDefault();
          actions.onOpenSettings?.('tags');
          return;
        }
        if (matchKeys(event, ['Alt', 'D'])) {
          event.preventDefault();
          actions.onOpenSettings?.('data');
          return;
        }
        if (matchKeys(event, ['Alt', 'B'])) {
          event.preventDefault();
          actions.onOpenSettings?.('shortcuts');
          return;
        }
        if (matchKeys(event, ['Alt', 'A'])) {
          event.preventDefault();
          actions.onOpenSettings?.('about');
          return;
        }
        // 格式切换
        if (matchKeys(event, ['Alt', '1'])) {
          event.preventDefault();
          actions.onSwitchFormat?.('excalidraw');
          return;
        }
        if (matchKeys(event, ['Alt', '2'])) {
          event.preventDefault();
          actions.onSwitchFormat?.('mermaid');
          return;
        }
        if (matchKeys(event, ['Alt', '3'])) {
          event.preventDefault();
          actions.onSwitchFormat?.('drawio');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

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
