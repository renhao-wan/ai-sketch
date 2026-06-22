'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Shortcut } from '@/lib/types/shortcuts';

/** 默认快捷键定义 — actionId 映射到 ShortcutActions 的回调 */
const DEFAULT_SHORTCUTS: Shortcut[] = [
  // 页面导航
  {
    id: 'go-home',
    keys: ['Alt', 'H'],
    description: '刷新页面',
    descriptionKey: 'shortcuts.goHome',
    scope: 'global',
    actionId: 'goHome',
  },
  {
    id: 'new-conversation',
    keys: ['Alt', 'N'],
    description: '新建对话',
    descriptionKey: 'shortcuts.newConversation',
    scope: 'global',
    actionId: 'newConversation',
  },
  // 设置页面
  {
    id: 'open-settings',
    keys: ['Alt', 'S'],
    description: '打开设置',
    descriptionKey: 'shortcuts.openSettings',
    scope: 'global',
    actionId: 'openSettings',
  },
  {
    id: 'open-appearance',
    keys: ['Alt', 'O'],
    description: '外观设置',
    descriptionKey: 'shortcuts.openAppearance',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'appearance',
  },
  {
    id: 'open-llm',
    keys: ['Alt', 'M'],
    description: 'LLM 配置',
    descriptionKey: 'shortcuts.openLLM',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'llm',
  },
  {
    id: 'open-conversations',
    keys: ['Alt', 'C'],
    description: '会话管理',
    descriptionKey: 'shortcuts.openConversations',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'conversations',
  },
  {
    id: 'open-tags',
    keys: ['Alt', 'T'],
    description: '标签管理',
    descriptionKey: 'shortcuts.openTags',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'tags',
  },
  {
    id: 'open-storage',
    keys: ['Alt', 'D'],
    description: '存储管理',
    descriptionKey: 'shortcuts.openStorage',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'storage',
  },
  {
    id: 'open-shortcuts',
    keys: ['Alt', 'B'],
    description: '快捷键设置',
    descriptionKey: 'shortcuts.openShortcuts',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'shortcuts',
  },
  {
    id: 'open-network',
    keys: ['Alt', 'K'],
    description: '网络设置',
    descriptionKey: 'shortcuts.openNetwork',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'network',
  },
  {
    id: 'open-about',
    keys: ['Alt', 'A'],
    description: '关于应用',
    descriptionKey: 'shortcuts.openAbout',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'about',
  },
  {
    id: 'open-ai-actions',
    keys: ['Alt', 'J'],
    description: 'AI 操作设置',
    descriptionKey: 'shortcuts.openAIActions',
    scope: 'global',
    actionId: 'openSettings',
    actionParam: 'aiActions',
  },
  // 格式切换
  {
    id: 'switch-excalidraw',
    keys: ['Alt', '1'],
    description: '切换到 Excalidraw',
    descriptionKey: 'shortcuts.switchExcalidraw',
    scope: 'editor',
    actionId: 'switchFormat',
    actionParam: 'excalidraw',
  },
  {
    id: 'switch-mermaid',
    keys: ['Alt', '2'],
    description: '切换到 Mermaid',
    descriptionKey: 'shortcuts.switchMermaid',
    scope: 'editor',
    actionId: 'switchFormat',
    actionParam: 'mermaid',
  },
  {
    id: 'switch-drawio',
    keys: ['Alt', '3'],
    description: '切换到 Draw.io',
    descriptionKey: 'shortcuts.switchDrawio',
    scope: 'editor',
    actionId: 'switchFormat',
    actionParam: 'drawio',
  },
  {
    id: 'open-version-history',
    keys: ['Alt', 'V'],
    description: '版本历史',
    descriptionKey: 'shortcuts.openVersionHistory',
    scope: 'global',
    actionId: 'openVersionHistory',
  },
  // 编辑操作（浏览器原生处理，仅用于展示）
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
  // 窗口控制（仅 Electron）
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
  onOpenSettings?: (tab?: string) => void;
  onSwitchFormat?: (format: 'excalidraw' | 'mermaid' | 'drawio') => void;
  onOpenVersionHistory?: () => void;
}

/** 动作 ID → 回调映射（构建一次，复用于每次按键） */
function buildActionMap(actions: ShortcutActions): Record<string, (param?: string) => void> {
  return {
    goHome: () => actions.onGoHome?.(),
    newConversation: () => actions.onNewConversation?.(),
    openSettings: (param) => actions.onOpenSettings?.(param),
    switchFormat: (param) => actions.onSwitchFormat?.(param as 'excalidraw' | 'mermaid' | 'drawio'),
    openVersionHistory: () => actions.onOpenVersionHistory?.(),
  };
}

/** 仅需自定义处理的快捷键（带 actionId 且含 Alt 的组合键） */
const CUSTOM_SHORTCUTS = DEFAULT_SHORTCUTS.filter(s => s.actionId && s.keys.some(k => k.toLowerCase() === 'alt'));

export function useShortcuts(actions?: ShortcutActions) {
  const [searchQuery, setSearchQuery] = useState('');

  // 注册全局快捷键 — 数据驱动，遍历 CUSTOM_SHORTCUTS 替代硬编码 if-else
  useEffect(() => {
    if (!actions) return;

    const actionMap = buildActionMap(actions);

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of CUSTOM_SHORTCUTS) {
        if (matchKeys(event, shortcut.keys)) {
          event.preventDefault();
          actionMap[shortcut.actionId!]?.(shortcut.actionParam);
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
