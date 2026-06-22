'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
function getPagePath(page: 'editor' | 'settings'): string {
  switch (page) {
    case 'editor': return '/';
    case 'settings': return '/settings';
    default: return '/';
  }
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
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // 初始化：检查是否需要显示欢迎弹窗或启动引导
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

  // 检查是否有重新引导的标记（从设置页面跳转过来）
  useEffect(() => {
    const restartMode = sessionStorage.getItem('onboarding-restart');
    if (restartMode && pathname === '/') {
      sessionStorage.removeItem('onboarding-restart');
      startOnboarding(restartMode as 'core' | 'full');
    }
  }, [pathname, startOnboarding]);

  // 路由变化时，如果有待处理的步骤跳转，应用它
  useEffect(() => {
    if (pendingStep === null || !state.isActive) return;

    const targetStep = state.steps[pendingStep];
    if (!targetStep) {
      setPendingStep(null);
      return;
    }

    const targetPath = getPagePath(targetStep.page);

    // 当页面加载完成后（pathname 匹配目标路径），应用步骤跳转
    if (pathname === targetPath) {
      setState((prev) => ({ ...prev, currentStep: pendingStep }));
      setPendingStep(null);
    }
  }, [pathname, pendingStep, state.isActive, state.steps]);

  /**
   * 下一步
   */
  const nextStep = useCallback(() => {
    // 先在 setState 外部检测是否需要跨页面导航
    const currentIndex = state.currentStep;
    const nextIndex = currentIndex + 1;

    // 检查是否完成
    if (nextIndex >= state.steps.length) {
      setOnboardingStatus(state.mode).catch(console.error);
      setState({
        ...DEFAULT_STATE,
        isLoading: false,
      });
      return;
    }

    const currentStepData = state.steps[currentIndex];
    const nextStepData = state.steps[nextIndex];

    // 检查是否需要跨页面导航
    if (currentStepData.page !== nextStepData.page) {
      // 触发路由跳转，设置 pendingStep，等页面加载完成后再更新步骤
      const targetPath = getPagePath(nextStepData.page);
      setPendingStep(nextIndex);
      router.push(targetPath);
      return;
    }

    // 同页面，直接更新步骤
    setState((prev) => ({ ...prev, currentStep: nextIndex }));
  }, [state, router]);

  /**
   * 上一步
   */
  const prevStep = useCallback(() => {
    if (state.currentStep <= 0) return;

    const prevStepIndex = state.currentStep - 1;
    const currentStepData = state.steps[state.currentStep];
    const prevStepData = state.steps[prevStepIndex];

    // 检查是否需要跨页面导航
    if (currentStepData.page !== prevStepData.page) {
      // 触发路由跳转，设置 pendingStep，等页面加载完成后再更新步骤
      const targetPath = getPagePath(prevStepData.page);
      setPendingStep(prevStepIndex);
      router.push(targetPath);
      return;
    }

    // 同页面，直接更新步骤
    setState((prev) => ({ ...prev, currentStep: prevStepIndex }));
  }, [state, router]);

  /**
   * 跳过引导
   */
  const skip = useCallback(() => {
    setOnboardingStatus('skipped').catch(console.error);
    setState({
      ...DEFAULT_STATE,
      isLoading: false,
    });
    router.push('/');
  }, [router]);

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
