import type { TranslationKey } from '@/lib/locales';

/**
 * 引导步骤数据结构
 */
export interface OnboardingStep {
  /** 步骤唯一标识 */
  id: string;
  /** CSS 选择器，高亮目标元素 */
  target: string;
  /** 提示框标题（国际化 key） */
  titleKey: TranslationKey;
  /** 提示框内容（国际化 key） */
  contentKey: TranslationKey;
  /** 提示框位置 */
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** 分组标识（full 模式用） */
  group?: string;
  /** 属于哪个模式 */
  mode: 'core' | 'full';
  /** 分组标题（国际化 key，分组第一步显示） */
  groupTitleKey?: TranslationKey;
  /** 步骤所在的页面 */
  page: 'home' | 'editor' | 'settings';
}

/**
 * 核心流程步骤（core 模式，7 步）
 * 介绍核心链路：首页输入 → 发送 → 进入编辑器 → 编辑器功能
 */
export const CORE_STEPS: OnboardingStep[] = [
  {
    id: 'home-input',
    target: '#onboarding-ai-prompt-box',
    titleKey: 'onboarding.steps.home-input.title',
    contentKey: 'onboarding.steps.home-input.content',
    placement: 'bottom',
    mode: 'core',
    page: 'home',
  },
  {
    id: 'home-send',
    target: '#onboarding-send-btn',
    titleKey: 'onboarding.steps.home-send.title',
    contentKey: 'onboarding.steps.home-send.content',
    placement: 'bottom',
    mode: 'core',
    page: 'home',
  },
  {
    id: 'home-editor-btn',
    target: '#onboarding-editor-btn',
    titleKey: 'onboarding.steps.home-editor-btn.title',
    contentKey: 'onboarding.steps.home-editor-btn.content',
    placement: 'bottom',
    mode: 'core',
    page: 'home',
  },
  {
    id: 'editor-chat',
    target: '#onboarding-chat-input',
    titleKey: 'onboarding.steps.editor-chat.title',
    contentKey: 'onboarding.steps.editor-chat.content',
    placement: 'right',
    mode: 'core',
    page: 'editor',
  },
  {
    id: 'editor-canvas',
    target: '#onboarding-diagram-canvas',
    titleKey: 'onboarding.steps.editor-canvas.title',
    contentKey: 'onboarding.steps.editor-canvas.content',
    placement: 'left',
    mode: 'core',
    page: 'editor',
  },
  {
    id: 'editor-code',
    target: '#onboarding-code-editor',
    titleKey: 'onboarding.steps.editor-code.title',
    contentKey: 'onboarding.steps.editor-code.content',
    placement: 'top',
    mode: 'core',
    page: 'editor',
  },
  {
    id: 'editor-back',
    target: '#onboarding-back-to-home',
    titleKey: 'onboarding.steps.editor-back.title',
    contentKey: 'onboarding.steps.editor-back.content',
    placement: 'bottom',
    mode: 'core',
    page: 'editor',
  },
];

/**
 * 完整流程步骤（full 模式）
 * 覆盖整个系统：首页、编辑器、设置
 */
export const FULL_STEPS: OnboardingStep[] = [
  // ==================== 首页组 ====================
  {
    id: 'full-home-input',
    target: '#onboarding-ai-prompt-box',
    titleKey: 'onboarding.steps.home-input.title',
    contentKey: 'onboarding.steps.home-input.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
    groupTitleKey: 'onboarding.groups.home',
    page: 'home',
  },
  {
    id: 'full-home-send',
    target: '#onboarding-send-btn',
    titleKey: 'onboarding.steps.home-send.title',
    contentKey: 'onboarding.steps.home-send.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
    page: 'home',
  },
  {
    id: 'full-home-templates',
    target: '#onboarding-templates',
    titleKey: 'onboarding.steps.home-templates.title',
    contentKey: 'onboarding.steps.home-templates.content',
    placement: 'top',
    mode: 'full',
    group: 'home',
    page: 'home',
  },
  {
    id: 'full-home-recent',
    target: '#onboarding-recent',
    titleKey: 'onboarding.steps.home-recent.title',
    contentKey: 'onboarding.steps.home-recent.content',
    placement: 'top',
    mode: 'full',
    group: 'home',
    page: 'home',
  },
  {
    id: 'full-home-history',
    target: '#onboarding-history-btn',
    titleKey: 'onboarding.steps.home-history.title',
    contentKey: 'onboarding.steps.home-history.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
    page: 'home',
  },
  {
    id: 'full-home-settings',
    target: '#onboarding-settings-btn',
    titleKey: 'onboarding.steps.home-settings.title',
    contentKey: 'onboarding.steps.home-settings.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
    page: 'home',
  },
  {
    id: 'full-home-editor-btn',
    target: '#onboarding-editor-btn',
    titleKey: 'onboarding.steps.home-editor-btn.title',
    contentKey: 'onboarding.steps.home-editor-btn.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
    page: 'home',
  },

  // ==================== 编辑器 - AI 对话区组 ====================
  {
    id: 'full-editor-chat',
    target: '#onboarding-chat-input',
    titleKey: 'onboarding.steps.editor-chat.title',
    contentKey: 'onboarding.steps.editor-chat.content',
    placement: 'right',
    mode: 'full',
    group: 'ai-chat',
    groupTitleKey: 'onboarding.groups.ai-chat',
    page: 'editor',
  },
  {
    id: 'full-format-selector',
    target: '#onboarding-format-selector',
    titleKey: 'onboarding.steps.format-selector.title',
    contentKey: 'onboarding.steps.format-selector.content',
    placement: 'bottom',
    mode: 'full',
    group: 'ai-chat',
    page: 'editor',
  },
  {
    id: 'full-chart-type',
    target: '#onboarding-chart-type',
    titleKey: 'onboarding.steps.chart-type.title',
    contentKey: 'onboarding.steps.chart-type.content',
    placement: 'bottom',
    mode: 'full',
    group: 'ai-chat',
    page: 'editor',
  },
  {
    id: 'full-generation-mode',
    target: '#onboarding-generation-mode',
    titleKey: 'onboarding.steps.generation-mode.title',
    contentKey: 'onboarding.steps.generation-mode.content',
    placement: 'bottom',
    mode: 'full',
    group: 'ai-chat',
    page: 'editor',
  },
  {
    id: 'full-context-toggle',
    target: '#onboarding-context-toggle',
    titleKey: 'onboarding.steps.context-toggle.title',
    contentKey: 'onboarding.steps.context-toggle.content',
    placement: 'bottom',
    mode: 'full',
    group: 'ai-chat',
    page: 'editor',
  },

  // ==================== 编辑器 - 画布与代码组 ====================
  {
    id: 'full-canvas',
    target: '#onboarding-diagram-canvas',
    titleKey: 'onboarding.steps.editor-canvas.title',
    contentKey: 'onboarding.steps.editor-canvas.content',
    placement: 'left',
    mode: 'full',
    group: 'canvas',
    groupTitleKey: 'onboarding.groups.canvas',
    page: 'editor',
  },
  {
    id: 'full-code-editor',
    target: '#onboarding-code-editor',
    titleKey: 'onboarding.steps.editor-code.title',
    contentKey: 'onboarding.steps.editor-code.content',
    placement: 'top',
    mode: 'full',
    group: 'canvas',
    page: 'editor',
  },

  // ==================== 编辑器 - 工具栏组 ====================
  {
    id: 'full-toolbar',
    target: '#onboarding-ai-action-layout',
    titleKey: 'onboarding.steps.toolbar.title',
    contentKey: 'onboarding.steps.toolbar.content',
    placement: 'left',
    mode: 'full',
    group: 'toolbar',
    groupTitleKey: 'onboarding.groups.toolbar',
    page: 'editor',
  },

  // ==================== 编辑器 - 顶部栏组 ====================
  {
    id: 'full-export',
    target: '#onboarding-export',
    titleKey: 'onboarding.steps.export.title',
    contentKey: 'onboarding.steps.export.content',
    placement: 'bottom',
    mode: 'full',
    group: 'top-bar',
    groupTitleKey: 'onboarding.groups.top-bar',
    page: 'editor',
  },
  {
    id: 'full-version-history',
    target: '#onboarding-version-history',
    titleKey: 'onboarding.steps.version-history.title',
    contentKey: 'onboarding.steps.version-history.content',
    placement: 'bottom',
    mode: 'full',
    group: 'top-bar',
    page: 'editor',
  },
  {
    id: 'full-back-to-home',
    target: '#onboarding-back-to-home',
    titleKey: 'onboarding.steps.editor-back.title',
    contentKey: 'onboarding.steps.editor-back.content',
    placement: 'bottom',
    mode: 'full',
    group: 'top-bar',
    page: 'editor',
  },

  // ==================== 设置页组 ====================
  {
    id: 'full-settings-appearance',
    target: '#onboarding-settings-appearance',
    titleKey: 'onboarding.steps.settings-appearance.title',
    contentKey: 'onboarding.steps.settings-appearance.content',
    placement: 'right',
    mode: 'full',
    group: 'settings',
    groupTitleKey: 'onboarding.groups.settings',
    page: 'settings',
  },
  {
    id: 'full-settings-llm',
    target: '#onboarding-settings-llm',
    titleKey: 'onboarding.steps.settings-llm.title',
    contentKey: 'onboarding.steps.settings-llm.content',
    placement: 'right',
    mode: 'full',
    group: 'settings',
    page: 'settings',
  },
  {
    id: 'full-settings-network',
    target: '#onboarding-settings-network',
    titleKey: 'onboarding.steps.settings-network.title',
    contentKey: 'onboarding.steps.settings-network.content',
    placement: 'right',
    mode: 'full',
    group: 'settings',
    page: 'settings',
  },
  {
    id: 'full-settings-shortcuts',
    target: '#onboarding-settings-shortcuts',
    titleKey: 'onboarding.steps.settings-shortcuts.title',
    contentKey: 'onboarding.steps.settings-shortcuts.content',
    placement: 'right',
    mode: 'full',
    group: 'settings',
    page: 'settings',
  },
];

/**
 * 根据模式获取步骤列表
 */
export function getStepsByMode(mode: 'core' | 'full'): OnboardingStep[] {
  return mode === 'core' ? CORE_STEPS : FULL_STEPS;
}
