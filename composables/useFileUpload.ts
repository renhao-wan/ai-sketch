/**
 * useFileUpload — 统一的文件上传 Hook
 *
 * 封装 InputOrchestrator 调用和附件状态管理，
 * 供 AIPromptBox（首页）和 AICopilotPanel（编辑器）共用。
 *
 * @example
 * const { attachments, payload, attachStatus, attachError, handleFiles, clearAttachments, canSend, getSourceType } = useFileUpload();
 * await handleFiles(files, prompt); // 首页场景
 * await handleFiles(files);         // 编辑器场景
 */

'use client';

import { useState, useCallback } from 'react';
import { imageStrategy, orchestrator } from '@/lib/input-strategies/registry';
import type { DiagramFormat } from '@/types/diagram-strategy';
import type { MessagePayload } from '@/types/input-strategy';

type AttachStatus = '' | 'processing' | 'success' | 'error';

interface UseFileUploadOptions {
  /** 图表格式，用于 ImageStrategy 生成默认 prompt */
  diagramFormat?: DiagramFormat;
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

  /** 判断是否可以发送（有 prompt 或有成功附件） */
  canSend: (hasPrompt: boolean) => boolean;
  /** 根据 payload 返回 sourceType */
  getSourceType: () => 'text' | 'file' | 'image';
  /** 手动设置错误状态（用于调用方的 catch 块） */
  setAttachError: (error: string) => void;
  /** 手动设置附件状态 */
  setAttachStatus: (status: AttachStatus) => void;
}

export function useFileUpload(options?: UseFileUploadOptions): UseFileUploadReturn {
  const [attachments, setAttachments] = useState<File[]>([]);
  const [payload, setPayload] = useState<MessagePayload | null>(null);
  const [attachStatus, setAttachStatus] = useState<AttachStatus>('');
  const [attachError, setAttachError] = useState('');

  const handleFiles = useCallback(async (files: File[], prompt?: string) => {
    if (files.length === 0) return;

    setAttachments([]);
    setPayload(null);
    setAttachStatus('processing');
    setAttachError('');

    // 为图片策略设置图表格式
    if (options?.diagramFormat) {
      imageStrategy.setDiagramFormat(options.diagramFormat);
    }

    const result = await orchestrator.handleFiles(files, prompt || '', 'auto');
    if (result.success) {
      setAttachments(files);
      setPayload(result.payload);
      setAttachStatus('success');
    } else {
      setAttachError(result.errors.map(e => `${e.fileName}: ${e.error}`).join('; '));
      setAttachStatus('error');
    }
  }, [options?.diagramFormat]);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setPayload(null);
    setAttachStatus('');
    setAttachError('');
  }, []);

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
    canSend,
    getSourceType,
    setAttachError,
    setAttachStatus,
  };
}
