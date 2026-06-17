'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
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
      return false;
    }

    const element = document.querySelector(currentStepData.target);
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
    return true;
  }, [currentStepData]);

  /**
   * 监听目标元素位置变化（带重试机制）
   */
  useEffect(() => {
    if (!isActive || !currentStepData) return;

    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let retryCount = 0;
    const maxRetries = 30; // 最多重试 30 次（3 秒）
    const retryInterval = 100;

    // 尝试查找目标元素，如果不存在则重试
    const tryUpdate = () => {
      const found = updateTargetRect();
      if (!found && retryCount < maxRetries) {
        retryCount++;
        if (!retryTimer) {
          retryTimer = setInterval(() => {
            const found = updateTargetRect();
            retryCount++;
            if (found || retryCount >= maxRetries) {
              if (retryTimer) {
                clearInterval(retryTimer);
                retryTimer = null;
              }
            }
          }, retryInterval);
        }
      }
    };

    // 首次尝试
    requestAnimationFrame(tryUpdate);

    // 监听滚动和 resize
    const handleUpdate = () => {
      requestAnimationFrame(updateTargetRect);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      if (retryTimer) {
        clearInterval(retryTimer);
      }
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isActive, currentStepData, updateTargetRect]);

  if (!isActive || !currentStepData) return null;

  // 目标元素还未找到，只显示遮罩（等待重试机制找到元素）
  const isWaitingForTarget = !targetRect;

  /**
   * 计算提示框位置（带边界检测）
   */
  const getTooltipPosition = (): CSSProperties => {
    if (!targetRect) {
      // 目标元素不存在，不显示提示框
      return { display: 'none' };
    }

    const gap = 12; // 提示框与目标的间距
    const tooltipWidth = 320; // w-80 = 20rem = 320px
    const tooltipHeight = 180; // 估算高度
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16; // 距离视口边缘的最小间距

    let top: number;
    let left: number;
    let placement = currentStepData.placement;

    // 根据首选 placement 计算初始位置
    switch (placement) {
      case 'top':
        top = targetRect.top - gap - tooltipHeight;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = targetRect.top + targetRect.height + gap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - gap - tooltipWidth;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left + targetRect.width + gap;
        break;
      default:
        top = targetRect.top + targetRect.height + gap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    }

    // 边界检测：如果提示框超出视口，调整位置
    // 水平边界
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > viewportWidth - padding) {
      left = viewportWidth - tooltipWidth - padding;
    }

    // 垂直边界
    if (top < padding) {
      top = padding;
    } else if (top + tooltipHeight > viewportHeight - padding) {
      top = viewportHeight - tooltipHeight - padding;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'none',
    };
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
