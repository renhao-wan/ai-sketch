'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
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
 * 根据步骤页面类型获取对应的路由路径
 */
function getPagePath(page: 'home' | 'editor'): string {
  return page === 'home' ? '/' : '/editor';
}

/**
 * 通过 API 设置引导状态
 * @param status - 完成状态：core（快速引导）、full（完整引导）、skipped（跳过）
 */
async function setOnboardingStatus(status: 'core' | 'full' | 'skipped'): Promise<void> {
  await fetch('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set-preference', key: 'onboarding_completed', value: status }),
  });
}

/**
 * 引导 Provider 组件
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const router = useRouter();

  // 初始化：检查是否需要显示欢迎弹窗
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const res = await fetch('/api/configs/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-preference', key: 'onboarding_completed' }),
        });
        const data = await res.json();
        const isCompleted = data.value !== null && data.value !== undefined;
        if (!isCompleted) {
          setState((prev) => ({ ...prev, showWelcome: true }));
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    checkOnboardingStatus();
  }, []);

  // 步骤变化时滚动到目标元素（支持跨页面导航后等待元素出现）
  useEffect(() => {
    if (!state.isActive || state.steps.length === 0) return;

    const currentStepData = state.steps[state.currentStep];
    if (!currentStepData) return;

    // 尝试查找并滚动到目标元素，如果不存在则重试
    let retryCount = 0;
    const maxRetries = 20; // 最多重试 20 次
    const retryInterval = 100; // 每次间隔 100ms

    const tryScrollToTarget = () => {
      const targetElement = document.querySelector(currentStepData.target);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };

    // 首次尝试
    if (tryScrollToTarget()) return;

    // 如果目标元素不存在，设置重试机制（处理跨页面导航的情况）
    const timer = setInterval(() => {
      retryCount++;
      if (tryScrollToTarget() || retryCount >= maxRetries) {
        clearInterval(timer);
      }
    }, retryInterval);

    return () => clearInterval(timer);
  }, [state.isActive, state.currentStep, state.steps]);

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

  // 跨页面导航：步骤变化时检测是否需要切换路由
  useEffect(() => {
    if (!state.isActive || state.steps.length === 0) return;

    const currentStepData = state.steps[state.currentStep];
    if (!currentStepData) return;

    const currentPath = window.location.pathname;
    const targetPath = getPagePath(currentStepData.page);

    // 如果当前页面不是目标页面，执行路由跳转
    if (currentPath !== targetPath) {
      router.push(targetPath);
    }
  }, [state.isActive, state.currentStep, state.steps, router]);

  /**
   * 下一步
   */
  const nextStep = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentStep + 1;

      // 检查是否完成
      if (nextIndex >= prev.steps.length) {
        // 完成引导
        setOnboardingStatus(prev.mode).catch(console.error);
        return {
          ...prev,
          isActive: false,
          currentStep: 0,
          steps: [],
        };
      }

      return { ...prev, currentStep: nextIndex };
    });
  }, []);

  /**
   * 上一步
   */
  const prevStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep <= 0) return prev;
      return { ...prev, currentStep: prev.currentStep - 1 };
    });
  }, []);

  /**
   * 跳过引导
   */
  const skip = useCallback(() => {
    setOnboardingStatus('skipped').catch(console.error);
    setState({
      ...DEFAULT_STATE,
      isLoading: false,
    });
  }, []);

  /**
   * 完成引导
   */
  const finish = useCallback(() => {
    setOnboardingStatus(state.mode).catch(console.error);
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

  const contextValue: OnboardingContextValue = useMemo(
    () => ({
      ...state,
      startOnboarding,
      nextStep,
      prevStep,
      skip,
      finish,
      closeWelcome,
    }),
    [state, startOnboarding, nextStep, prevStep, skip, finish, closeWelcome]
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}
