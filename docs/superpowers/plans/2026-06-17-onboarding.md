# 新手引导功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ai-sketch 应用添加新手引导功能，支持首次打开选择引导模式（快速/完整/跳过），步骤式高亮引导，状态持久化到数据库。

**Architecture:** 基于 React Context + hooks 模式实现全局引导状态管理，使用现有 meta 表存储引导完成状态，自定义遮罩 + 高亮 + 提示框组件实现步骤式引导。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, SQLite (sql.js), 现有 Context + hooks 架构

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `lib/db/onboarding-manager.ts` | 数据库操作（读写引导状态） |
| `components/onboarding/OnboardingProvider.tsx` | Context Provider + 状态管理 |
| `components/onboarding/OnboardingOverlay.tsx` | 遮罩 + 高亮 + 提示框 |
| `components/onboarding/WelcomeModal.tsx` | 首次欢迎弹窗（模式选择） |
| `components/onboarding/useOnboarding.ts` | Hook，供页面组件使用 |
| `components/onboarding/steps.ts` | 步骤定义（core + full 模式） |
| `components/onboarding/index.ts` | 统一导出 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `components/layout/ClientProviders.tsx` | 添加 OnboardingProvider |
| `app/page.tsx` | 首页关键元素添加 id 属性 |
| `app/editor/page.tsx` | 编辑器关键元素添加 id 属性 |
| `lib/locales/zh.ts` | 添加引导相关中文翻译 |
| `lib/locales/en.ts` | 添加引导相关英文翻译 |
| `components/settings/AboutSettings.tsx` | 添加"重新查看引导"入口 |

---

## Task 1: 数据库操作层

**Files:**
- Create: `lib/db/onboarding-manager.ts`

- [ ] **Step 1: 创建 OnboardingManager 类**

```typescript
// lib/db/onboarding-manager.ts
import { getDb } from './index';
import { configManager } from './config-manager';

/**
 * 新手引导状态管理器
 * 使用 meta 表存储引导完成状态
 */
class OnboardingManager {
  private static readonly STATUS_KEY = 'onboarding_completed';
  private static readonly TIMESTAMP_KEY = 'onboarding_completed_at';

  /**
   * 获取引导状态
   * @returns 'core' | 'full' | 'skipped' | null
   */
  async getStatus(): Promise<string | null> {
    return configManager.getPreference(OnboardingManager.STATUS_KEY);
  }

  /**
   * 设置引导状态
   * @param status - 完成状态：core（快速引导）、full（完整引导）、skipped（跳过）
   */
  async setStatus(status: 'core' | 'full' | 'skipped'): Promise<void> {
    await configManager.setPreference(OnboardingManager.STATUS_KEY, status);
    await configManager.setPreference(
      OnboardingManager.TIMESTAMP_KEY,
      new Date().toISOString()
    );
  }

  /**
   * 检查是否已完成引导
   * @returns true 如果已完成或跳过
   */
  async isCompleted(): Promise<boolean> {
    const status = await this.getStatus();
    return status !== null;
  }

  /**
   * 重置引导状态（用于重新触发）
   */
  async reset(): Promise<void> {
    const db = await getDb();
    db.run(`DELETE FROM meta WHERE key = '${OnboardingManager.STATUS_KEY}'`);
    db.run(`DELETE FROM meta WHERE key = '${OnboardingManager.TIMESTAMP_KEY}'`);
  }
}

export const onboardingManager = new OnboardingManager();
```

- [ ] **Step 2: 验证文件创建成功**

Run: `ls -la lib/db/onboarding-manager.ts`
Expected: 文件存在，大小约 1KB

- [ ] **Step 3: 提交**

```bash
git add lib/db/onboarding-manager.ts
git commit -m "feat(onboarding): 添加引导状态数据库管理器"
```

---

## Task 2: 步骤定义

**Files:**
- Create: `components/onboarding/steps.ts`

- [ ] **Step 1: 创建步骤定义文件**

```typescript
// components/onboarding/steps.ts

/**
 * 引导步骤数据结构
 */
export interface OnboardingStep {
  /** 步骤唯一标识 */
  id: string;
  /** CSS 选择器，高亮目标元素 */
  target: string;
  /** 提示框标题（国际化 key） */
  titleKey: string;
  /** 提示框内容（国际化 key） */
  contentKey: string;
  /** 提示框位置 */
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** 分组标识（full 模式用） */
  group?: string;
  /** 属于哪个模式 */
  mode: 'core' | 'full';
  /** 分组标题（国际化 key，分组第一步显示） */
  groupTitleKey?: string;
}

/**
 * 核心流程步骤（core 模式，6 步）
 * 介绍核心链路：首页输入 → 编辑器查看
 */
export const CORE_STEPS: OnboardingStep[] = [
  {
    id: 'home-input',
    target: '#onboarding-ai-prompt-box',
    titleKey: 'onboarding.steps.home-input.title',
    contentKey: 'onboarding.steps.home-input.content',
    placement: 'bottom',
    mode: 'core',
  },
  {
    id: 'home-generate',
    target: '#onboarding-generate-button',
    titleKey: 'onboarding.steps.home-generate.title',
    contentKey: 'onboarding.steps.home-generate.content',
    placement: 'bottom',
    mode: 'core',
  },
  {
    id: 'editor-chat',
    target: '#onboarding-chat-input',
    titleKey: 'onboarding.steps.editor-chat.title',
    contentKey: 'onboarding.steps.editor-chat.content',
    placement: 'right',
    mode: 'core',
  },
  {
    id: 'editor-canvas',
    target: '#onboarding-diagram-canvas',
    titleKey: 'onboarding.steps.editor-canvas.title',
    contentKey: 'onboarding.steps.editor-canvas.content',
    placement: 'left',
    mode: 'core',
  },
  {
    id: 'editor-code',
    target: '#onboarding-code-editor',
    titleKey: 'onboarding.steps.editor-code.title',
    contentKey: 'onboarding.steps.editor-code.content',
    placement: 'top',
    mode: 'core',
  },
  {
    id: 'editor-back',
    target: '#onboarding-back-to-home',
    titleKey: 'onboarding.steps.editor-back.title',
    contentKey: 'onboarding.steps.editor-back.content',
    placement: 'bottom',
    mode: 'core',
  },
];

/**
 * 完整流程步骤（full 模式，约 18 步）
 * 分组介绍所有功能
 */
export const FULL_STEPS: OnboardingStep[] = [
  // 首页组
  {
    id: 'full-home-input',
    target: '#onboarding-ai-prompt-box',
    titleKey: 'onboarding.steps.home-input.title',
    contentKey: 'onboarding.steps.home-input.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
    groupTitleKey: 'onboarding.groups.home',
  },
  {
    id: 'full-home-generate',
    target: '#onboarding-generate-button',
    titleKey: 'onboarding.steps.home-generate.title',
    contentKey: 'onboarding.steps.home-generate.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
  },

  // AI 对话区组
  {
    id: 'full-editor-chat',
    target: '#onboarding-chat-input',
    titleKey: 'onboarding.steps.editor-chat.title',
    contentKey: 'onboarding.steps.editor-chat.content',
    placement: 'right',
    mode: 'full',
    group: 'ai-chat',
    groupTitleKey: 'onboarding.groups.ai-chat',
  },
  {
    id: 'full-format-selector',
    target: '#onboarding-format-selector',
    titleKey: 'onboarding.steps.format-selector.title',
    contentKey: 'onboarding.steps.format-selector.content',
    placement: 'bottom',
    mode: 'full',
    group: 'ai-chat',
  },
  {
    id: 'full-chart-type',
    target: '#onboarding-chart-type',
    titleKey: 'onboarding.steps.chart-type.title',
    contentKey: 'onboarding.steps.chart-type.content',
    placement: 'bottom',
    mode: 'full',
    group: 'ai-chat',
  },
  {
    id: 'full-generation-mode',
    target: '#onboarding-generation-mode',
    titleKey: 'onboarding.steps.generation-mode.title',
    contentKey: 'onboarding.steps.generation-mode.content',
    placement: 'bottom',
    mode: 'full',
    group: 'ai-chat',
  },
  {
    id: 'full-context-toggle',
    target: '#onboarding-context-toggle',
    titleKey: 'onboarding.steps.context-toggle.title',
    contentKey: 'onboarding.steps.context-toggle.content',
    placement: 'bottom',
    mode: 'full',
    group: 'ai-chat',
  },

  // 画布操作区组
  {
    id: 'full-canvas',
    target: '#onboarding-diagram-canvas',
    titleKey: 'onboarding.steps.editor-canvas.title',
    contentKey: 'onboarding.steps.editor-canvas.content',
    placement: 'left',
    mode: 'full',
    group: 'canvas',
    groupTitleKey: 'onboarding.groups.canvas',
  },
  {
    id: 'full-zoom-toolbar',
    target: '#onboarding-zoom-toolbar',
    titleKey: 'onboarding.steps.zoom-toolbar.title',
    contentKey: 'onboarding.steps.zoom-toolbar.content',
    placement: 'left',
    mode: 'full',
    group: 'canvas',
  },

  // 代码编辑区组
  {
    id: 'full-code-editor',
    target: '#onboarding-code-editor',
    titleKey: 'onboarding.steps.editor-code.title',
    contentKey: 'onboarding.steps.editor-code.content',
    placement: 'top',
    mode: 'full',
    group: 'code-editor',
    groupTitleKey: 'onboarding.groups.code-editor',
  },

  // 工具栏区组
  {
    id: 'full-ai-action-layout',
    target: '#onboarding-ai-action-layout',
    titleKey: 'onboarding.steps.ai-action-layout.title',
    contentKey: 'onboarding.steps.ai-action-layout.content',
    placement: 'left',
    mode: 'full',
    group: 'toolbar',
    groupTitleKey: 'onboarding.groups.toolbar',
  },
  {
    id: 'full-ai-action-beautify',
    target: '#onboarding-ai-action-beautify',
    titleKey: 'onboarding.steps.ai-action-beautify.title',
    contentKey: 'onboarding.steps.ai-action-beautify.content',
    placement: 'left',
    mode: 'full',
    group: 'toolbar',
  },
  {
    id: 'full-ai-action-simplify',
    target: '#onboarding-ai-action-simplify',
    titleKey: 'onboarding.steps.ai-action-simplify.title',
    contentKey: 'onboarding.steps.ai-action-simplify.content',
    placement: 'left',
    mode: 'full',
    group: 'toolbar',
  },
  {
    id: 'full-ai-action-explain',
    target: '#onboarding-ai-action-explain',
    titleKey: 'onboarding.steps.ai-action-explain.title',
    contentKey: 'onboarding.steps.ai-action-explain.content',
    placement: 'left',
    mode: 'full',
    group: 'toolbar',
  },

  // 顶部栏组
  {
    id: 'full-export',
    target: '#onboarding-export',
    titleKey: 'onboarding.steps.export.title',
    contentKey: 'onboarding.steps.export.content',
    placement: 'bottom',
    mode: 'full',
    group: 'top-bar',
    groupTitleKey: 'onboarding.groups.top-bar',
  },
  {
    id: 'full-version-history',
    target: '#onboarding-version-history',
    titleKey: 'onboarding.steps.version-history.title',
    contentKey: 'onboarding.steps.version-history.content',
    placement: 'bottom',
    mode: 'full',
    group: 'top-bar',
  },
  {
    id: 'full-back-to-home',
    target: '#onboarding-back-to-home',
    titleKey: 'onboarding.steps.editor-back.title',
    contentKey: 'onboarding.steps.editor-back.content',
    placement: 'bottom',
    mode: 'full',
    group: 'top-bar',
  },
];

/**
 * 根据模式获取步骤列表
 */
export function getStepsByMode(mode: 'core' | 'full'): OnboardingStep[] {
  return mode === 'core' ? CORE_STEPS : FULL_STEPS;
}
```

- [ ] **Step 2: 创建目录**

Run: `mkdir -p components/onboarding`
Expected: 目录创建成功

- [ ] **Step 3: 提交**

```bash
git add components/onboarding/steps.ts
git commit -m "feat(onboarding): 添加引导步骤定义"
```

---

## Task 3: 国际化翻译

**Files:**
- Modify: `lib/locales/zh.ts`
- Modify: `lib/locales/en.ts`

- [ ] **Step 1: 添加中文翻译到 zh.ts**

在文件末尾（`as const` 之前）添加以下翻译：

```typescript
// 新手引导
'onboarding.welcome.title': '欢迎使用 AI Sketch！',
'onboarding.welcome.subtitle': '选择引导模式，快速上手',
'onboarding.welcome.core': '快速引导',
'onboarding.welcome.coreDesc': '介绍核心流程，约 2 分钟',
'onboarding.welcome.full': '完整引导',
'onboarding.welcome.fullDesc': '介绍所有功能，约 5 分钟',
'onboarding.welcome.skip': '跳过，直接开始',

'onboarding.step.prev': '上一步',
'onboarding.step.next': '下一步',
'onboarding.step.finish': '完成',
'onboarding.step.skip': '跳过引导',
'onboarding.step.progress': '{current} / {total}',

'onboarding.groups.home': '首页',
'onboarding.groups.ai-chat': 'AI 对话区',
'onboarding.groups.canvas': '画布操作区',
'onboarding.groups.code-editor': '代码编辑区',
'onboarding.groups.toolbar': '工具栏区',
'onboarding.groups.top-bar': '顶部栏',

'onboarding.steps.home-input.title': '输入描述',
'onboarding.steps.home-input.content': '在这里输入你想要生成的图表描述，支持中英文，描述越详细生成效果越好。',
'onboarding.steps.home-generate.title': '生成按钮',
'onboarding.steps.home-generate.content': '点击生成按钮或按 Enter 键，AI 将根据你的描述生成图表。',
'onboarding.steps.editor-chat.title': 'AI 对话区',
'onboarding.steps.editor-chat.content': '在这里与 AI 对话，可以继续描述需求、要求修改、或询问图表相关内容。',
'onboarding.steps.editor-canvas.title': '画布区域',
'onboarding.steps.editor-canvas.content': '生成的图表会在这里渲染显示，支持缩放、拖拽、右键菜单等操作。',
'onboarding.steps.editor-code.title': '代码编辑器',
'onboarding.steps.editor-code.content': '这里显示图表的源代码，你可以直接编辑代码来微调图表。',
'onboarding.steps.editor-back.title': '返回首页',
'onboarding.steps.editor-back.content': '点击这里可以返回首页，查看历史会话或创建新图表。',
'onboarding.steps.format-selector.title': '格式选择',
'onboarding.steps.format-selector.content': '选择图表格式：Excalidraw（手绘风格）、Mermaid（流程图）、Draw.io（专业图表）。',
'onboarding.steps.chart-type.title': '图表类型',
'onboarding.steps.chart-type.content': '指定图表类型可以帮助 AI 更精准地生成，如流程图、架构图、ER 图等。',
'onboarding.steps.generation-mode.title': '生成模式',
'onboarding.steps.generation-mode.content': '快速模式生成速度快，高质量模式效果更好，自动模式会根据复杂度自动选择。',
'onboarding.steps.context-toggle.title': '上下文开关',
'onboarding.steps.context-toggle.content': '开启后 AI 会参考之前的对话内容，关闭则每次独立生成。',
'onboarding.steps.zoom-toolbar.title': '缩放工具栏',
'onboarding.steps.zoom-toolbar.content': '放大、缩小、适应画布，也可以使用鼠标滚轮缩放。',
'onboarding.steps.ai-action-layout.title': '自动布局',
'onboarding.steps.ai-action-layout.content': 'AI 自动优化图表元素的排列布局。',
'onboarding.steps.ai-action-beautify.title': '美化',
'onboarding.steps.ai-action-beautify.content': 'AI 自动美化图表样式，调整颜色、间距等。',
'onboarding.steps.ai-action-simplify.title': '简化',
'onboarding.steps.ai-action-simplify.content': 'AI 自动简化图表，移除不必要的细节。',
'onboarding.steps.ai-action-explain.title': '解释',
'onboarding.steps.ai-action-explain.content': 'AI 解释图表内容，帮助你理解复杂图表。',
'onboarding.steps.export.title': '导出',
'onboarding.steps.export.content': '将图表导出为 PNG、SVG、PDF 或代码文件。',
'onboarding.steps.version-history.title': '版本历史',
'onboarding.steps.version-history.content': '查看和恢复之前生成的版本，方便对比和回退。',

'onboarding.settings.title': '引导与帮助',
'onboarding.settings.restart': '重新查看完整引导',
'onboarding.settings.restartDesc': '重新体验完整的新手引导流程',
```

- [ ] **Step 2: 添加英文翻译到 en.ts**

在文件末尾添加以下翻译：

```typescript
// Onboarding
'onboarding.welcome.title': 'Welcome to AI Sketch!',
'onboarding.welcome.subtitle': 'Choose a guide mode to get started',
'onboarding.welcome.core': 'Quick Guide',
'onboarding.welcome.coreDesc': 'Core workflow, about 2 minutes',
'onboarding.welcome.full': 'Full Guide',
'onboarding.welcome.fullDesc': 'All features, about 5 minutes',
'onboarding.welcome.skip': 'Skip, start directly',

'onboarding.step.prev': 'Previous',
'onboarding.step.next': 'Next',
'onboarding.step.finish': 'Finish',
'onboarding.step.skip': 'Skip Guide',
'onboarding.step.progress': '{current} / {total}',

'onboarding.groups.home': 'Homepage',
'onboarding.groups.ai-chat': 'AI Chat',
'onboarding.groups.canvas': 'Canvas',
'onboarding.groups.code-editor': 'Code Editor',
'onboarding.groups.toolbar': 'Toolbar',
'onboarding.groups.top-bar': 'Top Bar',

'onboarding.steps.home-input.title': 'Input Description',
'onboarding.steps.home-input.content': 'Enter your diagram description here. Supports both Chinese and English. More detailed descriptions produce better results.',
'onboarding.steps.home-generate.title': 'Generate Button',
'onboarding.steps.home-generate.content': 'Click the generate button or press Enter, and AI will create a diagram based on your description.',
'onboarding.steps.editor-chat.title': 'AI Chat Panel',
'onboarding.steps.editor-chat.content': 'Chat with AI here to refine your request, ask for modifications, or inquire about the diagram.',
'onboarding.steps.editor-canvas.title': 'Canvas Area',
'onboarding.steps.editor-canvas.content': 'Generated diagrams are rendered here. Supports zoom, drag, and right-click menu operations.',
'onboarding.steps.editor-code.title': 'Code Editor',
'onboarding.steps.editor-code.content': 'View and edit the diagram source code here for fine-tuning.',
'onboarding.steps.editor-back.title': 'Back to Home',
'onboarding.steps.editor-back.content': 'Click here to return to the homepage, view history or create new diagrams.',
'onboarding.steps.format-selector.title': 'Format Selection',
'onboarding.steps.format-selector.content': 'Choose diagram format: Excalidraw (hand-drawn), Mermaid (flowcharts), Draw.io (professional diagrams).',
'onboarding.steps.chart-type.title': 'Chart Type',
'onboarding.steps.chart-type.content': 'Specifying the chart type helps AI generate more accurate results, such as flowcharts, architecture diagrams, ER diagrams, etc.',
'onboarding.steps.generation-mode.title': 'Generation Mode',
'onboarding.steps.generation-mode.content': 'Fast mode has quicker generation, high quality mode produces better results, auto mode selects based on complexity.',
'onboarding.steps.context-toggle.title': 'Context Toggle',
'onboarding.steps.context-toggle.content': 'When enabled, AI references previous conversation content. When disabled, each generation is independent.',
'onboarding.steps.zoom-toolbar.title': 'Zoom Toolbar',
'onboarding.steps.zoom-toolbar.content': 'Zoom in, zoom out, fit to canvas. You can also use mouse wheel to zoom.',
'onboarding.steps.ai-action-layout.title': 'Auto Layout',
'onboarding.steps.ai-action-layout.content': 'AI automatically optimizes the arrangement and layout of diagram elements.',
'onboarding.steps.ai-action-beautify.title': 'Beautify',
'onboarding.steps.ai-action-beautify.content': 'AI automatically beautifies diagram styles, adjusting colors, spacing, etc.',
'onboarding.steps.ai-action-simplify.title': 'Simplify',
'onboarding.steps.ai-action-simplify.content': 'AI automatically simplifies the diagram, removing unnecessary details.',
'onboarding.steps.ai-action-explain.title': 'Explain',
'onboarding.steps.ai-action-explain.content': 'AI explains the diagram content to help you understand complex diagrams.',
'onboarding.steps.export.title': 'Export',
'onboarding.steps.export.content': 'Export diagrams as PNG, SVG, PDF, or code files.',
'onboarding.steps.version-history.title': 'Version History',
'onboarding.steps.version-history.content': 'View and restore previously generated versions for comparison and rollback.',

'onboarding.settings.title': 'Guide & Help',
'onboarding.settings.restart': 'Restart Full Guide',
'onboarding.settings.restartDesc': 'Experience the full onboarding flow again',
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd ai-sketch && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(onboarding): 添加引导功能国际化翻译"
```

---

## Task 4: OnboardingProvider

**Files:**
- Create: `components/onboarding/OnboardingProvider.tsx`

- [ ] **Step 1: 创建 OnboardingProvider**

```typescript
// components/onboarding/OnboardingProvider.tsx
'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { onboardingManager } from '@/lib/db/onboarding-manager';
import { getStepsByMode, type OnboardingStep } from './steps';

/**
 * 引导状态接口
 */
interface OnboardingState {
  /** 引导是否激活 */
  isActive: boolean;
  /** 当前步骤索引 */
  currentStep: number;
  /** 步骤列表 */
  steps: OnboardingStep[];
  /** 引导模式 */
  mode: 'core' | 'full';
  /** 是否显示欢迎弹窗 */
  showWelcome: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
}

/**
 * Context 暴露的接口
 */
interface OnboardingContextValue extends OnboardingState {
  /** 开始引导 */
  startOnboarding: (mode: 'core' | 'full') => void;
  /** 下一步 */
  nextStep: () => void;
  /** 上一步 */
  prevStep: () => void;
  /** 跳过引导 */
  skip: () => void;
  /** 完成引导 */
  finish: () => void;
  /** 关闭欢迎弹窗 */
  closeWelcome: () => void;
}

/**
 * 创建 Context
 */
export const OnboardingContext = createContext<OnboardingContextValue | null>(
  null
);

/**
 * 默认状态
 */
const DEFAULT_STATE: OnboardingState = {
  isActive: false,
  currentStep: 0,
  steps: [],
  mode: 'core',
  showWelcome: false,
  isLoading: true,
};

/**
 * 引导 Provider 组件
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);

  // 初始化：检查是否需要显示欢迎弹窗
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const isCompleted = await onboardingManager.isCompleted();
        if (!isCompleted) {
          setState((prev) => ({ ...prev, showWelcome: true }));
        }
      } catch (error) {
        console.error('检查引导状态失败:', error);
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    checkOnboardingStatus();
  }, []);

  /**
   * 开始引导
   */
  const startOnboarding = useCallback((mode: 'core' | 'full') => {
    const steps = getStepsByMode(mode);
    setState({
      isActive: true,
      currentStep: 0,
      steps,
      mode,
      showWelcome: false,
      isLoading: false,
    });
  }, []);

  /**
   * 下一步
   */
  const nextStep = useCallback(() => {
    setState((prev) => {
      const nextStep = prev.currentStep + 1;

      // 检查是否完成
      if (nextStep >= prev.steps.length) {
        // 完成引导
        onboardingManager.setStatus(prev.mode).catch(console.error);
        return {
          ...prev,
          isActive: false,
          currentStep: 0,
          steps: [],
        };
      }

      // 检查是否需要切换页面
      const currentStepData = prev.steps[prev.currentStep];
      const nextStepData = prev.steps[nextStep];

      // 如果目标元素不存在，自动跳过
      const targetElement = document.querySelector(nextStepData.target);
      if (!targetElement) {
        // 继续尝试下一步
        return { ...prev, currentStep: nextStep };
      }

      // 滚动到目标元素
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      return { ...prev, currentStep: nextStep };
    });
  }, [router]);

  /**
   * 上一步
   */
  const prevStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep <= 0) return prev;

      const prevStepIndex = prev.currentStep - 1;
      const prevStepData = prev.steps[prevStepIndex];

      // 滚动到目标元素
      const targetElement = document.querySelector(prevStepData.target);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      return { ...prev, currentStep: prevStepIndex };
    });
  }, []);

  /**
   * 跳过引导
   */
  const skip = useCallback(() => {
    onboardingManager.setStatus('skipped').catch(console.error);
    setState({
      ...DEFAULT_STATE,
      isLoading: false,
    });
  }, []);

  /**
   * 完成引导
   */
  const finish = useCallback(() => {
    onboardingManager.setStatus(state.mode).catch(console.error);
    setState({
      ...DEFAULT_STATE,
      isLoading: false,
    });
  }, [state.mode]);

  /**
   * 关闭欢迎弹窗
   */
  const closeWelcome = useCallback(() => {
    setState((prev) => ({ ...prev, showWelcome: false }));
  }, []);

  const contextValue: OnboardingContextValue = {
    ...state,
    startOnboarding,
    nextStep,
    prevStep,
    skip,
    finish,
    closeWelcome,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/onboarding/OnboardingProvider.tsx
git commit -m "feat(onboarding): 添加 OnboardingProvider 组件"
```

---

## Task 5: useOnboarding Hook

**Files:**
- Create: `components/onboarding/useOnboarding.ts`

- [ ] **Step 1: 创建 useOnboarding Hook**

```typescript
// components/onboarding/useOnboarding.ts
'use client';

import { useContext } from 'react';
import { OnboardingContext } from './OnboardingProvider';

/**
 * 使用引导功能的 Hook
 *
 * @example
 * ```tsx
 * const { isActive, currentStep, steps, nextStep } = useOnboarding();
 *
 * if (isActive) {
 *   // 渲染引导覆盖层
 * }
 * ```
 */
export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding 必须在 OnboardingProvider 内使用');
  }
  return ctx;
}
```

- [ ] **Step 2: 提交**

```bash
git add components/onboarding/useOnboarding.ts
git commit -m "feat(onboarding): 添加 useOnboarding Hook"
```

---

## Task 6: WelcomeModal 组件

**Files:**
- Create: `components/onboarding/WelcomeModal.tsx`

- [ ] **Step 1: 创建 WelcomeModal 组件**

```typescript
// components/onboarding/WelcomeModal.tsx
'use client';

import { useLocale } from '@/lib/locales';
import { useOnboarding } from './useOnboarding';
import { Zap, BookOpen, ArrowRight } from 'lucide-react';

/**
 * 首次打开时的欢迎弹窗
 * 让用户选择引导模式或跳过
 */
export function WelcomeModal() {
  const { t } = useLocale();
  const { showWelcome, startOnboarding, closeWelcome, skip } =
    useOnboarding();

  if (!showWelcome) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      {/* 弹窗主体 */}
      <div className="relative bg-[var(--surface-warm)] backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] max-w-md w-full animate-slide-up">
        {/* 内容 */}
        <div className="px-8 pt-8 pb-6 text-center">
          {/* 图标 */}
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>

          {/* 标题 */}
          <h2 className="text-xl font-bold text-[var(--fg)] mb-2">
            {t('onboarding.welcome.title')}
          </h2>
          <p className="text-sm text-[var(--muted)] mb-6">
            {t('onboarding.welcome.subtitle')}
          </p>

          {/* 引导模式选项 */}
          <div className="space-y-3 mb-6">
            {/* 快速引导 */}
            <button
              onClick={() => startOnboarding('core')}
              className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent-indigo)]/50 transition-all duration-200 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-indigo)]/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-[var(--accent-indigo)]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[var(--fg)]">
                    {t('onboarding.welcome.core')}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {t('onboarding.welcome.coreDesc')}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>

            {/* 完整引导 */}
            <button
              onClick={() => startOnboarding('full')}
              className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent-purple)]/50 transition-all duration-200 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-purple)]/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-[var(--accent-purple)]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[var(--fg)]">
                    {t('onboarding.welcome.full')}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {t('onboarding.welcome.fullDesc')}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>

          {/* 跳过链接 */}
          <button
            onClick={() => {
              skip();
              closeWelcome();
            }}
            className="text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            {t('onboarding.welcome.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/onboarding/WelcomeModal.tsx
git commit -m "feat(onboarding): 添加 WelcomeModal 欢迎弹窗"
```

---

## Task 7: OnboardingOverlay 组件

**Files:**
- Create: `components/onboarding/OnboardingOverlay.tsx`

- [ ] **Step 1: 创建 OnboardingOverlay 组件**

```typescript
// components/onboarding/OnboardingOverlay.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLocale } from '@/lib/locales';
import { useOnboarding } from './useOnboarding';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * 目标元素位置信息
 */
interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * 引导覆盖层组件
 * 渲染遮罩、高亮区域和提示框
 */
export function OnboardingOverlay() {
  const { t } = useLocale();
  const { isActive, currentStep, steps, nextStep, prevStep, skip, finish } =
    useOnboarding();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  /**
   * 计算目标元素位置
   */
  const updateTargetRect = useCallback(() => {
    if (!currentStepData) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(currentStepData.target);
    if (!element) {
      setTargetRect(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [currentStepData]);

  /**
   * 监听目标元素位置变化
   */
  useEffect(() => {
    if (!isActive) return;

    updateTargetRect();

    // 监听滚动和 resize
    const handleUpdate = () => {
      requestAnimationFrame(updateTargetRect);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // 延迟显示，等待动画
    const timer = setTimeout(() => setIsVisible(true), 50);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      clearTimeout(timer);
    };
  }, [isActive, updateTargetRect]);

  /**
   * 切换步骤时的动画
   */
  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, [currentStep]);

  if (!isActive || !currentStepData) return null;

  /**
   * 计算提示框位置
   */
  const getTooltipPosition = () => {
    if (!targetRect) {
      // 目标元素不存在，居中显示
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = 12; // 提示框与目标的间距
    const tooltipWidth = 320;
    const tooltipHeight = 200; // 估算高度

    switch (currentStepData.placement) {
      case 'top':
        return {
          top: targetRect.top - gap,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          top: targetRect.top + targetRect.height + gap,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, 0)',
        };
      case 'left':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left - gap,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left + targetRect.width + gap,
          transform: 'translate(0, -50%)',
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  const tooltipStyle = getTooltipPosition();

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" />

      {/* 高亮区域（挖空） */}
      {targetRect && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
          }}
        >
          {/* 高亮边框 */}
          <div className="absolute inset-0 rounded-lg ring-2 ring-[var(--accent-indigo)] ring-offset-2 ring-offset-[var(--surface)]" />
        </div>
      )}

      {/* 提示框 */}
      <div
        className={`absolute pointer-events-auto transition-all duration-300 ${
          isVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
        }`}
        style={{
          top: tooltipStyle.top,
          left: tooltipStyle.left,
          transform: tooltipStyle.transform,
        }}
      >
        <div className="w-80 bg-[var(--surface-warm)] backdrop-blur-2xl rounded-2xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="text-xs text-[var(--muted)]">
              {t('onboarding.step.progress', {
                current: String(currentStep + 1),
                total: String(steps.length),
              })}
            </div>
            <button
              onClick={skip}
              className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              {t('onboarding.step.skip')}
            </button>
          </div>

          {/* 内容 */}
          <div className="px-5 pb-2">
            <h3 className="text-base font-semibold text-[var(--fg)] mb-1">
              {t(currentStepData.titleKey)}
            </h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              {t(currentStepData.contentKey)}
            </p>
          </div>

          {/* 底部按钮 */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <button
              onClick={prevStep}
              disabled={isFirstStep}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('onboarding.step.prev')}
            </button>

            {isLastStep ? (
              <button
                onClick={finish}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-lg hover:bg-[var(--btn-primary-hover)] transition-colors"
              >
                {t('onboarding.step.finish')}
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-lg hover:bg-[var(--btn-primary-hover)] transition-colors"
              >
                {t('onboarding.step.next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/onboarding/OnboardingOverlay.tsx
git commit -m "feat(onboarding): 添加 OnboardingOverlay 覆盖层组件"
```

---

## Task 8: 统一导出

**Files:**
- Create: `components/onboarding/index.ts`

- [ ] **Step 1: 创建统一导出文件**

```typescript
// components/onboarding/index.ts
export { OnboardingProvider } from './OnboardingProvider';
export { OnboardingOverlay } from './OnboardingOverlay';
export { WelcomeModal } from './WelcomeModal';
export { useOnboarding } from './useOnboarding';
export type { OnboardingStep } from './steps';
```

- [ ] **Step 2: 提交**

```bash
git add components/onboarding/index.ts
git commit -m "feat(onboarding): 添加统一导出文件"
```

---

## Task 9: 集成到 ClientProviders

**Files:**
- Modify: `components/layout/ClientProviders.tsx`

- [ ] **Step 1: 修改 ClientProviders**

在文件中添加 OnboardingProvider 的导入和使用：

```typescript
// 在 imports 部分添加
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';

// 修改 return 语句，添加 OnboardingProvider
return (
  <SettingsProvider>
    <LocaleProvider>
      <NotificationProvider>
        <OnboardingProvider>
          {children}
          <WelcomeModal />
          <OnboardingOverlay />
        </OnboardingProvider>
      </NotificationProvider>
    </LocaleProvider>
  </SettingsProvider>
);
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd ai-sketch && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add components/layout/ClientProviders.tsx
git commit -m "feat(onboarding): 集成 OnboardingProvider 到根布局"
```

---

## Task 10: 首页添加 ID 属性

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 为 AIPromptBox 添加 ID**

找到 `<AIPromptBox />` 组件，包裹一个带 ID 的 div：

```tsx
{/* 在 AIPromptBox 外层添加包裹 */}
<div id="onboarding-ai-prompt-box">
  <AIPromptBox />
</div>
```

- [ ] **Step 2: 为"进入编辑器"按钮添加 ID**

找到"进入编辑器"按钮，添加 ID：

```tsx
<button
  id="onboarding-generate-button"
  onClick={() => router.push('/editor')}
  className="..."
>
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd ai-sketch && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add app/page.tsx
git commit -m "feat(onboarding): 首页添加引导目标 ID"
```

---

## Task 11: 编辑器页面添加 ID 属性

**Files:**
- Modify: `app/editor/page.tsx`
- Modify: `components/ai/ChatInput.tsx`
- Modify: `components/ai/FloatingAIActions.tsx`
- Modify: `components/canvases/ZoomToolbar.tsx`
- Modify: `components/editor/FormatSelector.tsx`
- Modify: `components/editor/ChartTypeSelect.tsx`
- Modify: `components/ai/GenerationModeToggle.tsx`
- Modify: `components/layout/EditorTopBar.tsx`

- [ ] **Step 1: 为编辑器主区域添加 ID**

在 `app/editor/page.tsx` 中：

```tsx
{/* AI Copilot Panel */}
<div id="onboarding-chat-input">
  <AICopilotPanel ... />
</div>

{/* DiagramCanvas */}
<div id="onboarding-diagram-canvas">
  <DiagramCanvas ... />
</div>

{/* 代码编辑器 */}
<div id="onboarding-code-editor">
  <BottomContextPanel ... />
</div>
```

- [ ] **Step 2: 为 ChatInput 子组件添加 ID**

在 `components/ai/ChatInput.tsx` 中：

```tsx
{/* 格式选择器 */}
<div id="onboarding-format-selector">
  <FormatSelector ... />
</div>

{/* 图表类型选择 */}
<div id="onboarding-chart-type">
  <ChartTypeSelect ... />
</div>

{/* 生成模式切换 */}
<div id="onboarding-generation-mode">
  <GenerationModeToggle ... />
</div>

{/* 上下文开关 */}
<div id="onboarding-context-toggle">
  {/* 上下文切换按钮 */}
</div>
```

- [ ] **Step 3: 为 FloatingAIActions 添加 ID**

在 `components/ai/FloatingAIActions.tsx` 中，为每个按钮添加 ID：

```tsx
<button id="onboarding-ai-action-layout" ...>布局</button>
<button id="onboarding-ai-action-beautify" ...>美化</button>
<button id="onboarding-ai-action-simplify" ...>简化</button>
<button id="onboarding-ai-action-explain" ...>解释</button>
```

- [ ] **Step 4: 为 ZoomToolbar 添加 ID**

在 `components/canvases/ZoomToolbar.tsx` 中：

```tsx
<div id="onboarding-zoom-toolbar" className="...">
```

- [ ] **Step 5: 为 EditorTopBar 按钮添加 ID**

在 `components/layout/EditorTopBar.tsx` 中：

```tsx
<button id="onboarding-export" ...>导出</button>
<button id="onboarding-version-history" ...>版本历史</button>
<button id="onboarding-back-to-home" ...>返回</button>
```

- [ ] **Step 6: 验证 TypeScript 编译**

Run: `cd ai-sketch && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
git add app/editor/page.tsx components/ai/ChatInput.tsx components/ai/FloatingAIActions.tsx components/canvases/ZoomToolbar.tsx components/layout/EditorTopBar.tsx
git commit -m "feat(onboarding): 编辑器页面添加引导目标 ID"
```

---

## Task 12: 设置页面添加引导入口

**Files:**
- Modify: `components/settings/AboutSettings.tsx`

- [ ] **Step 1: 添加引导入口到 AboutSettings**

在 `AboutSettings.tsx` 中添加导入和新 section：

```typescript
// 添加导入
import { useOnboarding } from '@/components/onboarding/useOnboarding';
import { BookOpen } from 'lucide-react';

// 在组件内部添加
const { startOnboarding } = useOnboarding();

// 在应用信息 section 和版本更新 section 之间添加新 section
<section className="space-y-4">
  <h3 className="text-lg font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
    <BookOpen className="w-5 h-5 text-[var(--accent-indigo)]" />
    {t('onboarding.settings.title')}
  </h3>

  <div className="p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium text-[var(--fg)]">
          {t('onboarding.settings.restart')}
        </h4>
        <p className="text-sm text-[var(--muted)] mt-1">
          {t('onboarding.settings.restartDesc')}
        </p>
      </div>
      <button
        onClick={() => startOnboarding('full')}
        className="px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-lg hover:bg-[var(--btn-primary-hover)] transition-colors"
      >
        {t('onboarding.settings.restart')}
      </button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd ai-sketch && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add components/settings/AboutSettings.tsx
git commit -m "feat(onboarding): 设置页面添加重新查看引导入口"
```

---

## Task 13: 最终验证与清理

- [ ] **Step 1: 运行 ESLint 检查**

Run: `cd ai-sketch && pnpm lint`
Expected: 无错误

- [ ] **Step 2: 运行 TypeScript 编译检查**

Run: `cd ai-sketch && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行开发服务器验证**

Run: `cd ai-sketch && pnpm dev`
Expected: 服务器启动成功，访问 http://localhost:3000 显示欢迎弹窗

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat(onboarding): 完成新手引导功能实现"
```

---

## 实现优先级总结

| 优先级 | 任务 | 说明 |
|--------|------|------|
| **P0** | Task 1-9 | 核心功能：数据库、Provider、Overlay、WelcomeModal、集成 |
| **P1** | Task 10-12 | 完整功能：添加 ID、设置入口 |
| **P2** | Task 13 | 验证与清理 |

---

## 注意事项

1. **ID 命名规范**：所有引导目标 ID 使用 `onboarding-` 前缀，避免与现有 ID 冲突
2. **样式一致性**：使用现有的 CSS 变量（`var(--surface-warm)` 等）保持毛玻璃风格
3. **国际化**：所有用户可见文本都通过 `t()` 函数翻译
4. **数据库操作**：复用 `configManager.getPreference/setPreference` 方法
5. **错误处理**：数据库操作使用 try-catch，失败时记录日志但不阻断用户流程
