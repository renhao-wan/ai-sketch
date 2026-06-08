/**
 * useFileUpload — 统一的文件上传 Hook
 *
 * 封装 InputOrchestrator 调用和附件状态管理，
 * 供 AIPromptBox（首页）和 AICopilotPanel（编辑器）共用。
 *
 * @example
 * const { attachments, payload, handleFiles, clearAttachments, removeAttachment, notification, closeNotification } = useFileUpload();
 * await handleFiles(files, prompt); // 首页场景
 * await handleFiles(files);         // 编辑器场景
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { orchestrator } from '@/lib/input-strategies/registry';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { MessagePayload } from '@/lib/types/input-strategy';

type AttachStatus = '' | 'processing' | 'success' | 'error';

interface NotificationState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface UseFileUploadOptions {
  /** 图表格式，用于 ImageStrategy 生成默认 prompt */
  diagramFormat?: DiagramFormat;
  /** 最大附件数量，默认 3 */
  maxItems?: number;
}

interface UseFileUploadReturn {
  /** 当前附件列表 */
  attachments: File[];
  /** 编排器产出的消息 payload */
  payload: MessagePayload | null;
  /** 附件处理状态 */
  attachStatus: AttachStatus;
  /** 错误信息 */
  attachError: string;

  /** 处理文件列表，调用编排器。prompt 可选（首页传，编辑器不传） */
  handleFiles: (files: File[], prompt?: string) => Promise<void>;
  /** 清除所有附件状态 */
  clearAttachments: () => void;
  /** 移除单个附件（按索引） */
  removeAttachment: (index: number) => void;

  /** 判断是否可以发送（有 prompt 或有成功附件） */
  canSend: (hasPrompt: boolean) => boolean;
  /** 根据 payload 返回 sourceType */
  getSourceType: () => 'text' | 'file' | 'image';
  /** 手动设置错误状态（用于调用方的 catch 块） */
  setAttachError: (error: string) => void;
  /** 手动设置附件状态 */
  setAttachStatus: (status: AttachStatus) => void;

  /** 全局通知状态（配合 Notification 组件使用） */
  notification: NotificationState;
  /** 关闭通知 */
  closeNotification: () => void;
}

export function useFileUpload(options?: UseFileUploadOptions): UseFileUploadReturn {
  const maxItems = options?.maxItems ?? 3;
  const [attachments, setAttachments] = useState<File[]>([]);
  const [payload, setPayload] = useState<MessagePayload | null>(null);
  const [attachStatus, setAttachStatus] = useState<AttachStatus>('');
  const [attachError, setAttachError] = useState('');
  const [notification, setNotification] = useState<NotificationState>({ isOpen: false, title: '', message: '', type: 'warning' });
  const attachmentsRef = useRef<File[]>([]);

  // Keep attachmentsRef in sync
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const closeNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- 使用可选链访问依赖属性，避免不必要的重渲染
  const handleFiles = useCallback(async (files: File[], prompt?: string) => {
    if (files.length === 0) return;

    // 合并已有附件和新文件
    const merged = [...attachmentsRef.current, ...files];

    // 限制附件数量
    if (merged.length > maxItems) {
      setNotification({ isOpen: true, title: '附件数量限制', message: `最多上传 ${maxItems} 个附件`, type: 'warning' });
      return;
    }

    setAttachStatus('processing');
    setAttachError('');

    try {
      const result = await orchestrator.handleFiles(merged, prompt || '', 'auto', options?.diagramFormat);
      if (result.success) {
        setAttachments(merged);
        setPayload(result.payload);
        setAttachStatus('success');
      } else {
        setAttachError(result.errors.map(e => `${e.fileName}: ${e.error}`).join('; '));
        setAttachStatus('error');
      }
    } catch (e) {
      console.error('[useFileUpload] 文件处理失败:', e);
      setAttachError((e as Error).message || '文件处理失败');
      setAttachStatus('error');
    }
  }, [options?.diagramFormat, maxItems]);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setPayload(null);
    setAttachStatus('');
    setAttachError('');
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- 使用可选链访问依赖属性，避免不必要的重渲染
  const removeAttachment = useCallback(async (index: number) => {
    const remaining = attachmentsRef.current.filter((_, i) => i !== index);
    if (remaining.length === 0) {
      setAttachments([]);
      setPayload(null);
      setAttachStatus('');
      setAttachError('');
      return;
    }

    setAttachStatus('processing');
    setAttachError('');

    try {
      const result = await orchestrator.handleFiles(remaining, '', 'auto', options?.diagramFormat);
      if (result.success) {
        setAttachments(remaining);
        setPayload(result.payload);
        setAttachStatus('success');
      } else {
        setAttachError(result.errors.map(e => `${e.fileName}: ${e.error}`).join('; '));
        setAttachStatus('error');
      }
    } catch (e) {
      console.error('[useFileUpload] 移除附件后重新处理失败:', e);
      setAttachError((e as Error).message || '处理失败');
      setAttachStatus('error');
    }
  }, [options?.diagramFormat]);

  const canSend = useCallback((hasPrompt: boolean): boolean => {
    return hasPrompt || (attachStatus === 'success' && payload !== null);
  }, [attachStatus, payload]);

  const getSourceType = useCallback((): 'text' | 'file' | 'image' => {
    if (!payload) return 'text';
    return payload.type === 'image' ? 'image' : 'file';
  }, [payload]);

  return {
    attachments,
    payload,
    attachStatus,
    attachError,
    handleFiles,
    clearAttachments,
    removeAttachment,
    canSend,
    getSourceType,
    setAttachError,
    setAttachStatus,
    notification,
    closeNotification,
  };
}
