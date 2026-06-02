import { useState, useEffect } from 'react';

interface UseCountBannerOptions {
  /** 当前数量 */
  count: number;
  /** 触发提示的阈值 */
  threshold: number;
  /** sessionStorage 存储键名 */
  storageKey: string;
}

interface UseCountBannerResult {
  /** 是否显示 Banner */
  showBanner: boolean;
  /** 关闭 Banner 的处理函数 */
  handleDismissBanner: () => void;
}

/**
 * 通用数量提示 Hook
 * 当数量达到阈值时显示可关闭的提示 Banner
 *
 * 初始值统一为 false（SSR 安全），mount 后通过 useEffect 读取 sessionStorage 决定是否显示。
 * 配合 Tab 始终挂载（display: none）模式，useEffect 在同一帧执行，不会产生布局闪烁。
 *
 * @example
 * ```tsx
 * const { showBanner, handleDismissBanner } = useCountBanner({
 *   count: totalCount,
 *   threshold: 50,
 *   storageKey: 'history-banner-dismissed',
 * });
 * ```
 */
export function useCountBanner({ count, threshold, storageKey }: UseCountBannerOptions): UseCountBannerResult {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (count >= threshold) {
      const dismissed = sessionStorage.getItem(storageKey);
      if (!dismissed) {
        setShowBanner(true);
        return;
      }
    }
    setShowBanner(false);
  }, [count, threshold, storageKey]);

  const handleDismissBanner = () => {
    setShowBanner(false);
    sessionStorage.setItem(storageKey, 'true');
  };

  return { showBanner, handleDismissBanner };
}
