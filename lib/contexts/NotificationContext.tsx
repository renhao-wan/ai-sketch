'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import Notification from '@/components/ui/Notification';

interface NotificationState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface NotificationContextValue {
  showNotification: (title: string, message?: string, type?: NotificationState['type']) => void;
  closeNotification: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_STATE: NotificationState = {
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<NotificationState>(DEFAULT_STATE);

  const showNotification = useCallback((title: string, message = '', type: NotificationState['type'] = 'info') => {
    setNotification({ isOpen: true, title, message, type });
  }, []);

  const closeNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, closeNotification }}>
      {children}
      <Notification
        isOpen={notification.isOpen}
        onClose={closeNotification}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
