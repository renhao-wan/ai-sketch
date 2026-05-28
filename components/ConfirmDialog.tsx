'use client';

import Modal from './ui/Modal';
import Button from './ui/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'warning',
}: ConfirmDialogProps) {
  const variantMap: Record<string, 'primary' | 'danger'> = {
    warning: 'primary',
    danger: 'danger',
    info: 'primary',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-[var(--muted)] mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          {cancelText}
        </Button>
        <Button variant={variantMap[type] || 'primary'} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
