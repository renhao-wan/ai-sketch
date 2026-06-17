'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLocale } from '@/lib/locales';
import { useOnboarding } from './useOnboarding';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

    // 延迟调用避免在 effect 中直接 setState
    requestAnimationFrame(updateTargetRect);

    // 监听滚动和 resize
    const handleUpdate = () => {
      requestAnimationFrame(updateTargetRect);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isActive, updateTargetRect]);

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

      {/* 提示框 - 使用 key 强制重新挂载以触发动画 */}
      <div
        key={currentStep}
        className="absolute pointer-events-auto animate-fade-in"
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
