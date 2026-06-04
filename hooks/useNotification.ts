import { useState, useCallback } from 'react';
import type { NotificationState } from '@/lib/types';

const DEFAULT_NOTIFICATION: NotificationState = {
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
};

/**
 * 通知状态管理 Hook
 * 提取自多个组件中重复的 notification state 模式
 */
export function useNotification() {
  const [notification, setNotification] = useState<NotificationState>(DEFAULT_NOTIFICATION);

  const showNotification = useCallback((title: string, message: string = '', type: NotificationState['type'] = 'info') => {
    setNotification({ isOpen: true, title, message, type });
  }, []);

  const closeNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  }, []);

  return { notification, setNotification, showNotification, closeNotification };
}
