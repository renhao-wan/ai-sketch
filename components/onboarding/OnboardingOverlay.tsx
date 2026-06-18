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
    if (!isActive || !currentStepData) return;

    // 计算位置
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 需要在 effect 中计算初始位置
    updateTargetRect();

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
  }, [isActive, currentStepData, updateTargetRect]);

  if (!isActive || !currentStepData) return null;

  /**
   * 计算提示框位置（带智能边界检测）
   * 当首选位置放不下时，自动尝试其他位置
   */
  const getTooltipPosition = (): CSSProperties => {
    if (!targetRect) {
      return { display: 'none' };
    }

    const gap = 12;
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 16;

    // 检查某个位置是否可用
    const canFit = (pos: { top: number; left: number }) => {
      return pos.top >= pad && pos.top + tooltipHeight <= vh - pad &&
             pos.left >= pad && pos.left + tooltipWidth <= vw - pad;
    };

    // 计算各个方向的位置
    const positions: Record<string, { top: number; left: number }> = {
      top: {
        top: targetRect.top - gap - tooltipHeight,
        left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
      },
      bottom: {
        top: targetRect.top + targetRect.height + gap,
        left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
      },
      left: {
        top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
        left: targetRect.left - gap - tooltipWidth,
      },
      right: {
        top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
        left: targetRect.left + targetRect.width + gap,
      },
    };

    // 优先使用首选位置，如果放不下则按优先级尝试其他位置
    const preferred = currentStepData.placement;
    const fallbacks: Record<string, string[]> = {
      top: ['bottom', 'left', 'right'],
      bottom: ['top', 'left', 'right'],
      left: ['right', 'top', 'bottom'],
      right: ['left', 'top', 'bottom'],
    };

    let finalPos = positions[preferred];
    if (!canFit(finalPos)) {
      for (const fallback of fallbacks[preferred]) {
        if (canFit(positions[fallback])) {
          finalPos = positions[fallback];
          break;
        }
      }
    }

    // 最终兜底：确保不超出视口
    let top = Math.max(pad, Math.min(finalPos.top, vh - tooltipHeight - pad));
    let left = Math.max(pad, Math.min(finalPos.left, vw - tooltipWidth - pad));

    return {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'none',
    };
  };

  const tooltipStyle = getTooltipPosition();

  return (
    <div className="fixed inset-0 z-[90]">
      {/* 高亮区域（挖空）- 使用 boxShadow 创建遮罩效果 */}
      {targetRect ? (
        <div
          className="absolute"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 高亮边框 */}
          <div className="absolute inset-0 rounded-lg ring-2 ring-[var(--accent-indigo)] ring-offset-2 ring-offset-[var(--surface)]" />
          {/* 透明遮罩 - 阻止点击穿透 */}
          <div className="absolute inset-0 cursor-default" />
        </div>
      ) : (
        /* 目标元素未找到时显示全屏遮罩 */
        <div
          className="absolute inset-0 bg-black/50"
          onClick={(e) => e.preventDefault()}
        />
      )}

      {/* 提示框 - 使用 key 强制重新挂载以触发动画 */}
      <div
        key={currentStep}
        className="absolute animate-fade-in"
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
