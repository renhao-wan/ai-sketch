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
  page: 'home' | 'editor';
}

/**
 * 核心流程步骤（core 模式，7 步）
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
    page: 'home',
  },
  {
    id: 'home-generate',
    target: '#onboarding-generate-button',
    titleKey: 'onboarding.steps.home-generate.title',
    contentKey: 'onboarding.steps.home-generate.content',
    placement: 'bottom',
    mode: 'core',
    page: 'home',
  },
  {
    id: 'navigate-to-editor',
    target: '#onboarding-generate-button',
    titleKey: 'onboarding.steps.navigate-to-editor.title',
    contentKey: 'onboarding.steps.navigate-to-editor.content',
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
    page: 'home',
  },
  {
    id: 'full-home-generate',
    target: '#onboarding-generate-button',
    titleKey: 'onboarding.steps.home-generate.title',
    contentKey: 'onboarding.steps.home-generate.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
    page: 'home',
  },
  {
    id: 'full-navigate-to-editor',
    target: '#onboarding-generate-button',
    titleKey: 'onboarding.steps.navigate-to-editor.title',
    contentKey: 'onboarding.steps.navigate-to-editor.content',
    placement: 'bottom',
    mode: 'full',
    group: 'home',
    page: 'home',
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
    page: 'editor',
  },
  {
    id: 'full-zoom-toolbar',
    target: '#onboarding-zoom-toolbar',
    titleKey: 'onboarding.steps.zoom-toolbar.title',
    contentKey: 'onboarding.steps.zoom-toolbar.content',
    placement: 'left',
    mode: 'full',
    group: 'canvas',
    page: 'editor',
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
    page: 'editor',
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
    page: 'editor',
  },
  {
    id: 'full-ai-action-beautify',
    target: '#onboarding-ai-action-beautify',
    titleKey: 'onboarding.steps.ai-action-beautify.title',
    contentKey: 'onboarding.steps.ai-action-beautify.content',
    placement: 'left',
    mode: 'full',
    group: 'toolbar',
    page: 'editor',
  },
  {
    id: 'full-ai-action-simplify',
    target: '#onboarding-ai-action-simplify',
    titleKey: 'onboarding.steps.ai-action-simplify.title',
    contentKey: 'onboarding.steps.ai-action-simplify.content',
    placement: 'left',
    mode: 'full',
    group: 'toolbar',
    page: 'editor',
  },
  {
    id: 'full-ai-action-explain',
    target: '#onboarding-ai-action-explain',
    titleKey: 'onboarding.steps.ai-action-explain.title',
    contentKey: 'onboarding.steps.ai-action-explain.content',
    placement: 'left',
    mode: 'full',
    group: 'toolbar',
    page: 'editor',
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
];

/**
 * 根据模式获取步骤列表
 */
export function getStepsByMode(mode: 'core' | 'full'): OnboardingStep[] {
  return mode === 'core' ? CORE_STEPS : FULL_STEPS;
}
