'use client';

import Modal from './ui/Modal';
import Button from './ui/Button';
import { useLocale } from '@/locales';

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
  title,
  message,
  confirmText,
  cancelText,
  type = 'warning',
}: ConfirmDialogProps) {
  const { t } = useLocale();
  const variantMap: Record<string, 'primary' | 'danger'> = {
    warning: 'primary',
    danger: 'danger',
    info: 'primary',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title ?? t('confirm.title')} maxWidth="max-w-md">
      <p className="text-sm text-[var(--muted)] mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          {cancelText ?? t('confirm.cancel')}
        </Button>
        <Button variant={variantMap[type] || 'primary'} onClick={onConfirm}>
          {confirmText ?? t('confirm.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
