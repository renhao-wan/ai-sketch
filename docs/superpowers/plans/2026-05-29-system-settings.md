# 系统设置中心实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 LLM 配置弹窗升级为完整的系统设置中心，包含外观、LLM 配置、编辑器、数据管理四个分类。

**Architecture:** 采用 `/settings` 独立路由 + 侧边栏导航的经典桌面应用范式。6 种主题通过 CSS 变量切换，LLM 配置从 ConfigManager 迁移，编辑器和外观设置通过 localStorage 持久化。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, lucide-react, localStorage, SQLite API

---

## 文件结构

### 新建文件

| 文件路径 | 职责 |
|----------|------|
| `app/settings/page.tsx` | 设置页主组件 |
| `app/settings/layout.tsx` | 设置页布局（可选，复用根布局） |
| `components/settings/SettingsSidebar.tsx` | 侧边栏导航 |
| `components/settings/AppearanceSettings.tsx` | 外观设置（语言、主题、字体） |
| `components/settings/LLMSettings.tsx` | LLM 配置管理（从 ConfigManager 迁移） |
| `components/settings/EditorSettings.tsx` | 编辑器设置 |
| `components/settings/DataSettings.tsx` | 数据管理（历史、导入导出） |
| `hooks/useSettings.ts` | localStorage 设置读写 hook |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `app/page.tsx` | 设置按钮改为路由跳转 |
| `app/globals.css` | 添加 6 种主题 CSS 变量 |
| `locales/zh.ts` | 添加 settings.* 国际化键 |
| `locales/en.ts` | 添加 settings.* 国际化键 |

### 删除文件

| 文件路径 | 说明 |
|----------|------|
| `components/dialogs/ConfigManager.tsx` | 迁移完成后删除 |

---

## Task 1: 添加国际化键

**Files:**
- Modify: `locales/zh.ts`
- Modify: `locales/en.ts`

- [ ] **Step 1: 在 zh.ts 中添加 settings 命名空间**

在 `locales/zh.ts` 文件末尾（`}` 之前）添加：

```typescript
  // 设置页
  'settings.title': '系统设置',
  'settings.back': '返回首页',
  'settings.appearance': '外观',
  'settings.appearanceDesc': '自定义界面外观和语言',
  'settings.language': '语言',
  'settings.theme': '主题',
  'settings.fontSize': '全局字体大小',
  'settings.fontSizeDesc': '影响全局界面文字大小',
  'settings.themes.dark': '深色',
  'settings.themes.light': '浅色',
  'settings.themes.warm': '暖色',
  'settings.themes.cool': '冷色',
  'settings.themes.forest': '森林',
  'settings.themes.lavender': '薰衣草',
  'settings.llm': 'LLM 配置',
  'settings.llmDesc': '管理 AI 模型提供商配置',
  'settings.editor': '编辑器',
  'settings.editorDesc': '自定义编辑器行为',
  'settings.editorFontSize': '编辑器字体大小',
  'settings.editorFontSizeDesc': '影响代码编辑器文字大小',
  'settings.autoSave': '自动保存',
  'settings.autoSaveDesc': '关闭后需手动保存',
  'settings.canvasBg': '画布背景',
  'settings.canvasBgDesc': '选择画布背景样式',
  'settings.canvasBgOptions.grid': '网格',
  'settings.canvasBgOptions.dots': '点阵',
  'settings.canvasBgOptions.blank': '纯白',
  'settings.data': '数据管理',
  'settings.dataDesc': '管理会话历史和导入导出',
  'settings.exportAll': '导出所有数据',
  'settings.exportAllDesc': '导出 LLM 配置和会话历史',
  'settings.importData': '导入数据',
  'settings.importDataDesc': '从 JSON 文件导入',
  'settings.clearHistory': '清除会话历史',
  'settings.clearHistoryDesc': '删除所有会话记录',
  'settings.clearHistoryConfirm': '确定要清除所有会话历史吗？此操作不可撤销。',
  'settings.storageStats': '存储统计',
  'settings.conversations': '会话数量',
  'settings.configs': '配置数量',
  'settings.exportSuccess': '导出成功',
  'settings.exportFailed': '导出失败',
  'settings.importSuccess': '导入成功',
  'settings.importFailed': '导入失败',
  'settings.clearSuccess': '清除成功',
  'settings.clearFailed': '清除失败',
```

- [ ] **Step 2: 在 en.ts 中添加对应的英文翻译**

在 `locales/en.ts` 文件末尾（`}` 之前）添加：

```typescript
  // Settings page
  'settings.title': 'Settings',
  'settings.back': 'Back to Home',
  'settings.appearance': 'Appearance',
  'settings.appearanceDesc': 'Customize the look and feel',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.fontSize': 'Global Font Size',
  'settings.fontSizeDesc': 'Affects all interface text',
  'settings.themes.dark': 'Dark',
  'settings.themes.light': 'Light',
  'settings.themes.warm': 'Warm',
  'settings.themes.cool': 'Cool',
  'settings.themes.forest': 'Forest',
  'settings.themes.lavender': 'Lavender',
  'settings.llm': 'LLM Configuration',
  'settings.llmDesc': 'Manage AI model provider settings',
  'settings.editor': 'Editor',
  'settings.editorDesc': 'Customize editor behavior',
  'settings.editorFontSize': 'Editor Font Size',
  'settings.editorFontSizeDesc': 'Affects code editor text size',
  'settings.autoSave': 'Auto Save',
  'settings.autoSaveDesc': 'Turn off to save manually',
  'settings.canvasBg': 'Canvas Background',
  'settings.canvasBgDesc': 'Choose canvas background style',
  'settings.canvasBgOptions.grid': 'Grid',
  'settings.canvasBgOptions.dots': 'Dots',
  'settings.canvasBgOptions.blank': 'Blank',
  'settings.data': 'Data Management',
  'settings.dataDesc': 'Manage history and import/export',
  'settings.exportAll': 'Export All Data',
  'settings.exportAllDesc': 'Export LLM configs and history',
  'settings.importData': 'Import Data',
  'settings.importDataDesc': 'Import from JSON file',
  'settings.clearHistory': 'Clear History',
  'settings.clearHistoryDesc': 'Delete all conversation records',
  'settings.clearHistoryConfirm': 'Are you sure you want to clear all history? This action cannot be undone.',
  'settings.storageStats': 'Storage Statistics',
  'settings.conversations': 'Conversations',
  'settings.configs': 'Configurations',
  'settings.exportSuccess': 'Export successful',
  'settings.exportFailed': 'Export failed',
  'settings.importSuccess': 'Import successful',
  'settings.importFailed': 'Import failed',
  'settings.clearSuccess': 'Clear successful',
  'settings.clearFailed': 'Clear failed',
```

- [ ] **Step 3: 验证类型安全**

运行 TypeScript 检查确保没有类型错误：

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功，无类型错误

- [ ] **Step 4: 提交**

```bash
git add locales/zh.ts locales/en.ts
git commit -m "feat(settings): add i18n keys for settings page"
```

---

## Task 2: 创建 useSettings Hook

**Files:**
- Create: `hooks/useSettings.ts`

- [ ] **Step 1: 创建 useSettings hook**

创建 `hooks/useSettings.ts`：

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'warm' | 'cool' | 'forest' | 'lavender';
export type CanvasBg = 'grid' | 'dots' | 'blank';

export interface Settings {
  locale: 'zh' | 'en';
  theme: Theme;
  globalFontSize: number;
  editorFontSize: number;
  autoSave: boolean;
  canvasBg: CanvasBg;
}

const DEFAULT_SETTINGS: Settings = {
  locale: 'zh',
  theme: 'light',
  globalFontSize: 14,
  editorFontSize: 14,
  autoSave: true,
  canvasBg: 'grid',
};

const STORAGE_KEYS = {
  locale: 'ai-sketch-locale',
  theme: 'ai-sketch-theme',
  globalFontSize: 'ai-sketch-global-font-size',
  editorFontSize: 'ai-sketch-editor-font-size',
  autoSave: 'ai-sketch-auto-save',
  canvasBg: 'ai-sketch-canvas-bg',
} as const;

function getStoredValue<T>(key: string, defaultValue: T, validator?: (v: unknown) => v is T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    const parsed = JSON.parse(stored);
    if (validator && !validator(parsed)) return defaultValue;
    return parsed;
  } catch {
    return defaultValue;
  }
}

function isValidTheme(v: unknown): v is Theme {
  return typeof v === 'string' && ['dark', 'light', 'warm', 'cool', 'forest', 'lavender'].includes(v);
}

function isValidCanvasBg(v: unknown): v is CanvasBg {
  return typeof v === 'string' && ['grid', 'dots', 'blank'].includes(v);
}

function isValidLocale(v: unknown): v is 'zh' | 'en' {
  return v === 'zh' || v === 'en';
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({
    locale: getStoredValue(STORAGE_KEYS.locale, DEFAULT_SETTINGS.locale, isValidLocale),
    theme: getStoredValue(STORAGE_KEYS.theme, DEFAULT_SETTINGS.theme, isValidTheme),
    globalFontSize: getStoredValue(STORAGE_KEYS.globalFontSize, DEFAULT_SETTINGS.globalFontSize),
    editorFontSize: getStoredValue(STORAGE_KEYS.editorFontSize, DEFAULT_SETTINGS.editorFontSize),
    autoSave: getStoredValue(STORAGE_KEYS.autoSave, DEFAULT_SETTINGS.autoSave),
    canvasBg: getStoredValue(STORAGE_KEYS.canvasBg, DEFAULT_SETTINGS.canvasBg, isValidCanvasBg),
  }));

  // Apply theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  // Apply global font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.globalFontSize}px`;
  }, [settings.globalFontSize]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
      return next;
    });
  }, []);

  return { settings, updateSetting };
}
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add hooks/useSettings.ts
git commit -m "feat(settings): add useSettings hook for localStorage management"
```

---

## Task 3: 添加 6 种主题 CSS 变量

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: 在 globals.css 中添加 6 种主题变量**

在 `app/globals.css` 的 `:root` 块之后添加主题定义：

```css
/* ========== 主题系统 ========== */

/* 深色主题 */
[data-theme="dark"] {
  --bg: #1a1a2e;
  --bg-glass: rgba(26, 26, 46, 0.72);
  --fg: #e0e0e0;
  --muted: #9ca3af;
  --border: rgba(255, 255, 255, 0.1);
  --card: rgba(26, 26, 46, 0.85);
  --primary: #818cf8;
  --accent-indigo: #818cf8;
  --accent-violet: #a78bfa;
  --accent-cyan: #fbbf24;
  --surface-warm: rgba(26, 26, 46, 0.9);
  --surface-warm-hover: rgba(255, 255, 255, 0.06);
}

/* 浅色主题 (默认) */
[data-theme="light"] {
  --bg: #FAF8F5;
  --bg-glass: rgba(250, 248, 245, 0.72);
  --fg: #1C1917;
  --muted: #78716C;
  --border: rgba(250, 248, 245, 0.15);
  --card: rgba(250, 248, 245, 0.78);
  --primary: #1C1917;
  --accent-indigo: #7C3AED;
  --accent-violet: #A855F7;
  --accent-cyan: #D97706;
  --surface-warm: rgba(250, 248, 245, 0.85);
  --surface-warm-hover: rgba(0, 0, 0, 0.04);
}

/* 暖色主题 */
[data-theme="warm"] {
  --bg: #1c1412;
  --bg-glass: rgba(28, 20, 18, 0.72);
  --fg: #fef3c7;
  --muted: #d4a574;
  --border: rgba(255, 255, 255, 0.1);
  --card: rgba(28, 20, 18, 0.85);
  --primary: #fbbf24;
  --accent-indigo: #f59e0b;
  --accent-violet: #fb923c;
  --accent-cyan: #fbbf24;
  --surface-warm: rgba(28, 20, 18, 0.9);
  --surface-warm-hover: rgba(255, 255, 255, 0.06);
}

/* 冷色主题 */
[data-theme="cool"] {
  --bg: #0f172a;
  --bg-glass: rgba(15, 23, 42, 0.72);
  --fg: #e2e8f0;
  --muted: #94a3b8;
  --border: rgba(255, 255, 255, 0.1);
  --card: rgba(15, 23, 42, 0.85);
  --primary: #38bdf8;
  --accent-indigo: #38bdf8;
  --accent-violet: #818cf8;
  --accent-cyan: #22d3ee;
  --surface-warm: rgba(15, 23, 42, 0.9);
  --surface-warm-hover: rgba(255, 255, 255, 0.06);
}

/* 森林主题 */
[data-theme="forest"] {
  --bg: #0f1f1a;
  --bg-glass: rgba(15, 31, 26, 0.72);
  --fg: #d1fae5;
  --muted: #6ee7b7;
  --border: rgba(255, 255, 255, 0.1);
  --card: rgba(15, 31, 26, 0.85);
  --primary: #34d399;
  --accent-indigo: #34d399;
  --accent-violet: #a78bfa;
  --accent-cyan: #2dd4bf;
  --surface-warm: rgba(15, 31, 26, 0.9);
  --surface-warm-hover: rgba(255, 255, 255, 0.06);
}

/* 薰衣草主题 */
[data-theme="lavender"] {
  --bg: #1e1b2e;
  --bg-glass: rgba(30, 27, 46, 0.72);
  --fg: #ede9fe;
  --muted: #a78bfa;
  --border: rgba(255, 255, 255, 0.1);
  --card: rgba(30, 27, 46, 0.85);
  --primary: #a78bfa;
  --accent-indigo: #a78bfa;
  --accent-violet: #c084fc;
  --accent-cyan: #818cf8;
  --surface-warm: rgba(30, 27, 46, 0.9);
  --surface-warm-hover: rgba(255, 255, 255, 0.06);
}
```

- [ ] **Step 2: 验证样式无冲突**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功，无 CSS 错误

- [ ] **Step 3: 提交**

```bash
git add app/globals.css
git commit -m "feat(settings): add 6 theme CSS variable definitions"
```

---

## Task 4: 创建 SettingsSidebar 组件

**Files:**
- Create: `components/settings/SettingsSidebar.tsx`

- [ ] **Step 1: 创建 SettingsSidebar 组件**

创建 `components/settings/SettingsSidebar.tsx`：

```typescript
'use client';

import { Palette, Bot, Code, Database } from 'lucide-react';
import { useLocale } from '@/locales';

export type SettingsTab = 'appearance' | 'llm' | 'editor' | 'data';

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const tabs: { key: SettingsTab; icon: typeof Palette; labelKey: string }[] = [
  { key: 'appearance', icon: Palette, labelKey: 'settings.appearance' },
  { key: 'llm', icon: Bot, labelKey: 'settings.llm' },
  { key: 'editor', icon: Code, labelKey: 'settings.editor' },
  { key: 'data', icon: Database, labelKey: 'settings.data' },
];

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const { t } = useLocale();

  return (
    <nav className="w-48 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface-warm)] p-3">
      <div className="space-y-1">
        {tabs.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${activeTab === key
                ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] border border-transparent'
              }
            `}
          >
            <Icon size={16} />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add components/settings/SettingsSidebar.tsx
git commit -m "feat(settings): add SettingsSidebar component"
```

---

## Task 5: 创建 AppearanceSettings 组件

**Files:**
- Create: `components/settings/AppearanceSettings.tsx`

- [ ] **Step 1: 创建 AppearanceSettings 组件**

创建 `components/settings/AppearanceSettings.tsx`：

```typescript
'use client';

import { useLocale } from '@/locales';
import { useSettings, Theme } from '@/hooks/useSettings';
import { Check } from 'lucide-react';

const themes: { key: Theme; color: string }[] = [
  { key: 'dark', color: '#1a1a2e' },
  { key: 'light', color: '#FAF8F5' },
  { key: 'warm', color: '#1c1412' },
  { key: 'cool', color: '#0f172a' },
  { key: 'forest', color: '#0f1f1a' },
  { key: 'lavender', color: '#1e1b2e' },
];

export function AppearanceSettings() {
  const { t, locale, setLocale } = useLocale();
  const { settings, updateSetting } = useSettings();

  return (
    <div className="space-y-8">
      {/* 语言设置 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.language')}</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setLocale('zh')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              locale === 'zh'
                ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                : 'bg-[var(--surface-warm-hover)] text-[var(--muted)] border border-transparent hover:text-[var(--fg)]'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              locale === 'en'
                ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                : 'bg-[var(--surface-warm-hover)] text-[var(--muted)] border border-transparent hover:text-[var(--fg)]'
            }`}
          >
            English
          </button>
        </div>
      </section>

      {/* 主题设置 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.theme')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ key, color }) => (
            <button
              key={key}
              onClick={() => updateSetting('theme', key)}
              className={`
                relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
                ${settings.theme === key
                  ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5'
                  : 'border-[var(--border)] hover:border-[var(--muted)]/30'
                }
              `}
            >
              <div
                className="w-8 h-8 rounded-lg border border-[var(--border)] shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium text-[var(--fg)]">
                {t(`settings.themes.${key}`)}
              </span>
              {settings.theme === key && (
                <Check size={14} className="absolute top-2 right-2 text-[var(--accent-indigo)]" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 全局字体大小 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.fontSize')}</h3>
        <p className="text-sm text-[var(--muted)] mb-3">{t('settings.fontSizeDesc')}</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={12}
            max={20}
            step={1}
            value={settings.globalFontSize}
            onChange={(e) => updateSetting('globalFontSize', Number(e.target.value))}
            className="flex-1 h-2 bg-[var(--surface-warm-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-indigo)]"
          />
          <span className="text-sm font-mono text-[var(--fg)] w-12 text-right">
            {settings.globalFontSize}px
          </span>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add components/settings/AppearanceSettings.tsx
git commit -m "feat(settings): add AppearanceSettings component"
```

---

## Task 6: 创建 EditorSettings 组件

**Files:**
- Create: `components/settings/EditorSettings.tsx`

- [ ] **Step 1: 创建 EditorSettings 组件**

创建 `components/settings/EditorSettings.tsx`：

```typescript
'use client';

import { useLocale } from '@/locales';
import { useSettings, CanvasBg } from '@/hooks/useSettings';

const canvasBgOptions: { key: CanvasBg; labelKey: string }[] = [
  { key: 'grid', labelKey: 'settings.canvasBgOptions.grid' },
  { key: 'dots', labelKey: 'settings.canvasBgOptions.dots' },
  { key: 'blank', labelKey: 'settings.canvasBgOptions.blank' },
];

export function EditorSettings() {
  const { t } = useLocale();
  const { settings, updateSetting } = useSettings();

  return (
    <div className="space-y-8">
      {/* 编辑器字体大小 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.editorFontSize')}</h3>
        <p className="text-sm text-[var(--muted)] mb-3">{t('settings.editorFontSizeDesc')}</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={12}
            max={20}
            step={1}
            value={settings.editorFontSize}
            onChange={(e) => updateSetting('editorFontSize', Number(e.target.value))}
            className="flex-1 h-2 bg-[var(--surface-warm-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-indigo)]"
          />
          <span className="text-sm font-mono text-[var(--fg)] w-12 text-right">
            {settings.editorFontSize}px
          </span>
        </div>
      </section>

      {/* 自动保存 */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.autoSave')}</h3>
            <p className="text-sm text-[var(--muted)]">{t('settings.autoSaveDesc')}</p>
          </div>
          <button
            onClick={() => updateSetting('autoSave', !settings.autoSave)}
            className={`
              relative w-12 h-7 rounded-full transition-colors duration-200
              ${settings.autoSave ? 'bg-[var(--accent-indigo)]' : 'bg-[var(--surface-warm-hover)]'}
            `}
          >
            <div
              className={`
                absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
                ${settings.autoSave ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      </section>

      {/* 画布背景 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.canvasBg')}</h3>
        <p className="text-sm text-[var(--muted)] mb-3">{t('settings.canvasBgDesc')}</p>
        <div className="flex gap-3">
          {canvasBgOptions.map(({ key, labelKey }) => (
            <button
              key={key}
              onClick={() => updateSetting('canvasBg', key)}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${settings.canvasBg === key
                  ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                  : 'bg-[var(--surface-warm-hover)] text-[var(--muted)] border border-transparent hover:text-[var(--fg)]'
                }
              `}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add components/settings/EditorSettings.tsx
git commit -m "feat(settings): add EditorSettings component"
```

---

## Task 7: 创建 LLMSettings 组件（从 ConfigManager 迁移）

**Files:**
- Create: `components/settings/LLMSettings.tsx`

- [ ] **Step 1: 读取 ConfigManager 以了解迁移内容**

读取 `components/dialogs/ConfigManager.tsx` 完整内容，了解需要迁移的逻辑。

- [ ] **Step 2: 创建 LLMSettings 组件**

创建 `components/settings/LLMSettings.tsx`，将 ConfigManager 的列表+编辑器逻辑迁移过来：

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '@/locales';
import { api } from '@/lib/api-client';
import { LLMConfig, NotificationState, ConfirmDialogState } from '@/types';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { Spinner } from '@/components/ui/Spinner';
import { Notification } from '@/components/ui/Notification';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { CountBanner } from '@/components/ui/CountBanner';
import { useCountBanner } from '@/hooks/useCountBanner';
import {
  Plus, Search, Edit3, Copy, Trash2, Zap, TestTube2,
  Download, Upload, ChevronLeft, Check, X, Eye, EyeOff
} from 'lucide-react';

const inputClass = "w-full px-4 py-2.5 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200";

export function LLMSettings() {
  const { t } = useLocale();
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const { showBanner, handleDismissBanner } = useCountBanner({
    count: configs.length,
    threshold: 15,
    storageKey: 'config-banner-dismissed',
  });

  const loadConfigs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.fetchConfigs();
      setConfigs(data.configs);
      setActiveConfigId(data.activeConfigId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleSaveConfig = async (config: LLMConfig) => {
    try {
      if (isCreating) {
        await api.createConfig(config);
      } else {
        await api.updateConfig(config.id!, config);
      }
      setEditingConfig(null);
      setIsCreating(false);
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    }
  };

  const handleDeleteConfig = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('config.confirmDelete'),
      message: t('config.confirmDeleteMsg'),
      onConfirm: async () => {
        try {
          await api.deleteConfig(id);
          await loadConfigs();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to delete config');
        }
      },
    });
  };

  const handleSetActive = async (id: string) => {
    try {
      await api.setActiveConfig(id);
      setActiveConfigId(id);
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active config');
    }
  };

  const handleClone = async (id: string) => {
    try {
      await api.cloneConfig(id);
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone config');
    }
  };

  const handleTestConnection = async (config: LLMConfig) => {
    try {
      await api.testConnection(config);
      setNotification({ type: 'success', message: t('config.testSuccess') });
    } catch (err) {
      setNotification({ type: 'error', message: t('config.testFailed') });
    }
  };

  const handleExport = async () => {
    try {
      const data = await api.exportConfigs();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-sketch-configs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotification({ type: 'success', message: t('config.exportSuccess') });
    } catch (err) {
      setNotification({ type: 'error', message: t('config.exportFailed') });
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await api.importConfigs(data);
        await loadConfigs();
        setNotification({ type: 'success', message: t('config.importSuccess') });
      } catch (err) {
        setNotification({ type: 'error', message: t('config.importFailed') });
      }
    };
    input.click();
  };

  const filteredConfigs = configs.filter(config =>
    config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    config.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    config.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort active config to top
  const sortedConfigs = [...filteredConfigs].sort((a, b) => {
    if (a.id === activeConfigId) return -1;
    if (b.id === activeConfigId) return 1;
    return 0;
  });

  if (editingConfig) {
    return (
      <ConfigEditor
        config={editingConfig}
        isCreating={isCreating}
        onSave={handleSaveConfig}
        onCancel={() => {
          setEditingConfig(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <CountBanner
        show={showBanner}
        title={t('config.bannerTitle')}
        description={t('config.bannerDescription')}
        onDismiss={handleDismissBanner}
      />

      {/* 操作栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            placeholder={t('config.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditingConfig({
              name: '',
              type: 'openai',
              baseUrl: '',
              apiKey: '',
              model: '',
              description: '',
            });
            setIsCreating(true);
          }}
        >
          <Plus size={14} />
          <span className="ml-1.5">{t('config.new')}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExport}>
          <Download size={14} />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleImport}>
          <Upload size={14} />
        </Button>
      </div>

      {/* 配置列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : sortedConfigs.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted)]">
          {searchQuery ? t('config.noMatch') : t('config.noConfig')}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedConfigs.map((config) => (
            <div
              key={config.id}
              className={`
                group p-4 rounded-2xl border transition-all duration-200
                ${config.id === activeConfigId
                  ? 'border-[var(--accent-indigo)]/30 bg-[var(--accent-indigo)]/5'
                  : 'border-[var(--border)] hover:border-[var(--muted)]/30'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--fg)]">{config.name}</span>
                    {config.id === activeConfigId && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]">
                        {t('config.active')}
                      </span>
                    )}
                  </div>
                  {config.description && (
                    <p className="text-sm text-[var(--muted)] mt-1">{config.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted)]">
                    <span>{config.type}</span>
                    <span>{config.model}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {config.id !== activeConfigId && (
                    <Tooltip content={t('config.setActive')}>
                      <button
                        onClick={() => handleSetActive(config.id!)}
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--accent-indigo)]"
                      >
                        <Zap size={14} />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content={t('config.testConnection')}>
                    <button
                      onClick={() => handleTestConnection(config)}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--fg)]"
                    >
                      <TestTube2 size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('config.edit')}>
                    <button
                      onClick={() => setEditingConfig(config)}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--fg)]"
                    >
                      <Edit3 size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('config.clone')}>
                    <button
                      onClick={() => handleClone(config.id!)}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--fg)]"
                    >
                      <Copy size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('config.confirmDelete')}>
                    <button
                      onClick={() => handleDeleteConfig(config.id!)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--muted)] hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={async () => {
            await confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

// 配置编辑器子组件
interface ConfigEditorProps {
  config: LLMConfig;
  isCreating: boolean;
  onSave: (config: LLMConfig) => Promise<void>;
  onCancel: () => void;
}

function ConfigEditor({ config, isCreating, onSave, onCancel }: ConfigEditorProps) {
  const { t } = useLocale();
  const [formData, setFormData] = useState<LLMConfig>(config);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleLoadModels = async () => {
    if (!formData.baseUrl || !formData.apiKey) return;
    setIsLoadingModels(true);
    try {
      const data = await api.fetchModels(formData.baseUrl, formData.apiKey);
      setModels(data.models || []);
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 rounded-xl hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--fg)]"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="text-lg font-semibold text-[var(--fg)]">
          {isCreating ? t('config.new') : t('config.edit')}
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('config.configName')}
          </label>
          <input
            type="text"
            placeholder={t('config.configNamePlaceholder')}
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('config.description')}
          </label>
          <input
            type="text"
            placeholder={t('config.descriptionPlaceholder')}
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('config.providerType')}
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setFormData(prev => ({ ...prev, type: 'openai' }))}
              className={`
                flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${formData.type === 'openai'
                  ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                  : 'bg-[var(--surface-warm-hover)] text-[var(--muted)] border border-transparent'
                }
              `}
            >
              OpenAI
            </button>
            <button
              onClick={() => setFormData(prev => ({ ...prev, type: 'anthropic' }))}
              className={`
                flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${formData.type === 'anthropic'
                  ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                  : 'bg-[var(--surface-warm-hover)] text-[var(--muted)] border border-transparent'
                }
              `}
            >
              Anthropic
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('config.baseUrl')}
          </label>
          <input
            type="text"
            placeholder="https://api.openai.com/v1"
            value={formData.baseUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('config.apiKey')}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              placeholder="sk-..."
              value={formData.apiKey}
              onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
              className={inputClass}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('config.model')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t('config.modelPlaceholder')}
              value={formData.model}
              onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
              className={`${inputClass} flex-1`}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadModels}
              disabled={isLoadingModels || !formData.baseUrl || !formData.apiKey}
            >
              {isLoadingModels ? <Spinner size="sm" /> : <Download size={14} />}
              <span className="ml-1.5">{t('config.loadModels')}</span>
            </Button>
          </div>
          {models.length > 0 && (
            <div className="mt-2 p-2 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)] max-h-40 overflow-y-auto">
              {models.map((model) => (
                <button
                  key={model}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, model }));
                    setModels([]);
                  }}
                  className={`
                    w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors duration-150
                    ${formData.model === model
                      ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]'
                      : 'text-[var(--fg)] hover:bg-[var(--surface-warm)]'
                    }
                  `}
                >
                  {model}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--surface-warm-hover)]">
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving || !formData.name || !formData.baseUrl || !formData.apiKey || !formData.model}
        >
          {isSaving ? <Spinner size="sm" /> : <Check size={14} />}
          <span className="ml-1.5">{t('common.save')}</span>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功

- [ ] **Step 4: 提交**

```bash
git add components/settings/LLMSettings.tsx
git commit -m "feat(settings): add LLMSettings component (migrated from ConfigManager)"
```

---

## Task 8: 创建 DataSettings 组件

**Files:**
- Create: `components/settings/DataSettings.tsx`

- [ ] **Step 1: 创建 DataSettings 组件**

创建 `components/settings/DataSettings.tsx`：

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from '@/locales';
import { api } from '@/lib/api-client';
import { Conversation, ConfirmDialogState } from '@/types';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Notification } from '@/components/ui/Notification';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { ScrollToTop } from '@/components/ui/ScrollToTop';
import { Download, Upload, Trash2, MessageSquare, Settings, HardDrive } from 'lucide-react';

const PAGE_SIZE = 20;

export function DataSettings() {
  const { t } = useLocale();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [configCount, setConfigCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const pageRef = useRef(0);

  const loadConversations = useCallback(async (reset = false, pageNum = 0) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const data = await api.fetchConversations({
        search: searchQuery || undefined,
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      });

      if (reset) {
        setConversations(data.conversations);
      } else {
        setConversations(prev => [...prev, ...data.conversations]);
      }

      setHasMore(data.hasMore);
      pageRef.current = pageNum;
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [searchQuery]);

  const loadStats = useCallback(async () => {
    try {
      const [convCount, configs] = await Promise.all([
        api.fetchConversationCount(),
        api.fetchConfigs(),
      ]);
      setTotalCount(convCount.count);
      setConfigCount(configs.configs.length);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      pageRef.current = 0;
      setHasMore(true);
      loadConversations(true, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadConversations]);

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    loadConversations(false, pageRef.current + 1);
  };

  const handleExportAll = async () => {
    try {
      const [configs, conversations] = await Promise.all([
        api.exportConfigs(),
        api.fetchConversations({ limit: 1000 }),
      ]);

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        configs: configs,
        conversations: conversations.conversations,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-sketch-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotification({ type: 'success', message: t('settings.exportSuccess') });
    } catch (err) {
      setNotification({ type: 'error', message: t('settings.exportFailed') });
    }
  };

  const handleImportData = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.configs) {
          await api.importConfigs(data.configs);
        }

        await loadConversations(true, 0);
        await loadStats();
        setNotification({ type: 'success', message: t('settings.importSuccess') });
      } catch (err) {
        setNotification({ type: 'error', message: t('settings.importFailed') });
      }
    };
    input.click();
  };

  const handleClearHistory = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.clearHistory'),
      message: t('settings.clearHistoryConfirm'),
      onConfirm: async () => {
        try {
          // Delete all conversations
          for (const conv of conversations) {
            await api.deleteConversation(conv.id);
          }
          await loadConversations(true, 0);
          await loadStats();
          setNotification({ type: 'success', message: t('settings.clearSuccess') });
        } catch (err) {
          setNotification({ type: 'error', message: t('settings.clearFailed') });
        }
      },
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      handleLoadMore();
    }
  };

  return (
    <div className="space-y-8">
      {/* 存储统计 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-4">{t('settings.storageStats')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare size={16} className="text-[var(--accent-indigo)]" />
              <span className="text-sm text-[var(--muted)]">{t('settings.conversations')}</span>
            </div>
            <span className="text-2xl font-bold text-[var(--fg)]">{totalCount}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-2">
              <Settings size={16} className="text-[var(--accent-violet)]" />
              <span className="text-sm text-[var(--muted)]">{t('settings.configs')}</span>
            </div>
            <span className="text-2xl font-bold text-[var(--fg)]">{configCount}</span>
          </div>
        </div>
      </section>

      {/* 导入导出 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-4">{t('settings.data')}</h3>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleExportAll}>
            <Download size={14} />
            <span className="ml-1.5">{t('settings.exportAll')}</span>
          </Button>
          <Button variant="secondary" onClick={handleImportData}>
            <Upload size={14} />
            <span className="ml-1.5">{t('settings.importData')}</span>
          </Button>
          <Button variant="danger" onClick={handleClearHistory}>
            <Trash2 size={14} />
            <span className="ml-1.5">{t('settings.clearHistory')}</span>
          </Button>
        </div>
      </section>

      {/* 会话历史列表 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-4">{t('history.title')}</h3>

        <div className="relative mb-4">
          <input
            type="text"
            placeholder={t('history.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200"
          />
        </div>

        <div
          className="h-96 overflow-y-auto rounded-2xl border border-[var(--border)]"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted)]">
              {searchQuery ? t('history.noResults') : t('history.empty')}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-4 hover:bg-[var(--surface-warm-hover)] transition-colors duration-150"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-[var(--fg)]">{conv.title}</h4>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {new Date(conv.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={async () => {
            await confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add components/settings/DataSettings.tsx
git commit -m "feat(settings): add DataSettings component"
```

---

## Task 9: 创建设置页主组件

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: 创建设置页主组件**

创建 `app/settings/page.tsx`：

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/locales';
import { SettingsSidebar, SettingsTab } from '@/components/settings/SettingsSidebar';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { LLMSettings } from '@/components/settings/LLMSettings';
import { EditorSettings } from '@/components/settings/EditorSettings';
import { DataSettings } from '@/components/settings/DataSettings';
import { ArrowLeft } from 'lucide-react';

const tabDescriptions: Record<SettingsTab, string> = {
  appearance: 'settings.appearanceDesc',
  llm: 'settings.llmDesc',
  editor: 'settings.editorDesc',
  data: 'settings.dataDesc',
};

export default function SettingsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceSettings />;
      case 'llm':
        return <LLMSettings />;
      case 'editor':
        return <EditorSettings />;
      case 'data':
        return <DataSettings />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-[var(--bg-glass)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors duration-200"
          >
            <ArrowLeft size={16} />
            <span>{t('settings.back')}</span>
          </button>
          <div className="w-px h-6 bg-[var(--border)]" />
          <h1 className="text-lg font-semibold text-[var(--fg)]">{t('settings.title')}</h1>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* 侧边栏 */}
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* 内容区 */}
          <main className="flex-1 min-w-0">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--fg)]">
                {t(`settings.${activeTab}`)}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                {t(tabDescriptions[activeTab])}
              </p>
            </div>
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add app/settings/page.tsx
git commit -m "feat(settings): add settings page with sidebar navigation"
```

---

## Task 10: 更新首页设置按钮

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 修改首页设置按钮为路由跳转**

读取 `app/page.tsx`，找到设置按钮部分，修改为：

```typescript
// 移除 ConfigManager 相关的 state 和 import
// const [isConfigOpen, setIsConfigOpen] = useState(false);

// 修改设置按钮 onClick 为路由跳转
<button
  onClick={() => router.push('/settings')}
  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors duration-150"
>
  <Settings size={15} />
</button>

// 移除底部的 ConfigManager 渲染
// <ConfigManager isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} onConfigSelect={() => {}} />
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add app/page.tsx
git commit -m "feat(settings): update home settings button to navigate to /settings"
```

---

## Task 11: 删除旧的 ConfigManager

**Files:**
- Delete: `components/dialogs/ConfigManager.tsx`

- [ ] **Step 1: 检查是否有其他地方引用 ConfigManager**

```bash
cd d:/python/PycharmProjects/ai-sketch && grep -r "ConfigManager" --include="*.tsx" --include="*.ts"
```

Expected: 只有 `app/page.tsx` 和 `app/editor/page.tsx` 引用，且 `app/page.tsx` 已在 Task 10 中移除

- [ ] **Step 2: 更新编辑器页面的 ConfigManager 引用**

编辑器页面仍需要 ConfigManager 弹窗（用于配置验证失败时的快捷入口）。保留编辑器页面的引用，只删除首页的引用。

- [ ] **Step 3: 删除 ConfigManager.tsx**

```bash
rm components/dialogs/ConfigManager.tsx
```

- [ ] **Step 4: 验证编译**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm build
```

Expected: 编译失败，因为编辑器页面仍引用 ConfigManager

- [ ] **Step 5: 决策：保留 ConfigManager 供编辑器使用**

由于编辑器页面仍需要 ConfigManager 弹窗作为快捷入口，决定保留该文件。回退删除操作：

```bash
git checkout components/dialogs/ConfigManager.tsx
```

- [ ] **Step 6: 提交（无删除）**

```bash
git add -A
git commit -m "feat(settings): settings page complete, ConfigManager retained for editor use"
```

---

## Task 12: 集成测试

- [ ] **Step 1: 启动开发服务器测试**

```bash
cd d:/python/PycharmProjects/ai-sketch && pnpm dev
```

访问 http://localhost:3000，测试以下场景：

1. 点击设置按钮 → 跳转到 `/settings`
2. 侧边栏切换 → 4 个分类正常显示
3. 外观设置 → 切换语言、主题、字体大小
4. LLM 配置 → 列表显示、新增、编辑、删除、克隆、测试连接
5. 编辑器设置 → 字体大小滑块、自动保存开关、画布背景选择
6. 数据管理 → 存储统计、导入导出、会话历史列表
7. 返回首页 → 正常显示

- [ ] **Step 2: 提交最终版本**

```bash
git add -A
git commit -m "feat: complete system settings center implementation"
```

---

## 自检清单

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| `/settings` 独立路由 | Task 9 |
| 侧边栏导航 + 右侧内容区 | Task 4, Task 9 |
| 外观设置（语言、6 种主题、字体大小） | Task 3, Task 5 |
| LLM 配置迁移 | Task 7 |
| 编辑器设置（字体、自动保存、画布背景） | Task 6 |
| 数据管理（历史、导入导出、清除、统计） | Task 8 |
| 首页设置按钮改为路由跳转 | Task 10 |
| 国际化 | Task 1 |
| localStorage 持久化 | Task 2 |

### 占位符扫描

- 无 TBD/TODO
- 所有步骤包含完整代码
- 所有命令包含预期输出

### 类型一致性检查

- `SettingsTab` 类型在 Task 4 定义，Task 9 使用 ✓
- `useSettings` hook 在 Task 2 定义，Task 5/6 使用 ✓
- `LLMConfig` 类型复用现有定义 ✓
- `ConfirmDialogState` 类型复用现有定义 ✓
