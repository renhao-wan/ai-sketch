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