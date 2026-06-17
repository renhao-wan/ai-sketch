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
