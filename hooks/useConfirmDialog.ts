import { useState, useCallback } from 'react';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

const DEFAULT_STATE: ConfirmDialogState = {
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
  variant: 'danger',
};

/**
 * 确认弹窗状态管理 Hook
 * 提取自多个组件中重复的 confirmDialog state 模式
 */
export function useConfirmDialog() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(DEFAULT_STATE);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, variant: ConfirmDialogState['variant'] = 'danger') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, variant });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  return { confirmDialog, setConfirmDialog, showConfirm, closeConfirm };
}
