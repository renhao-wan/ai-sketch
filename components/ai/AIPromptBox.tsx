'use client';

import { useState, useRef, useEffect, useMemo, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paperclip,
  Image,
  Sparkles,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { setInitData } from '@/lib/utils/init-data';
import { useLocale } from '@/lib/locales';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import FormatSelector from '@/components/editor/FormatSelector';
import Notification from '@/components/ui/Notification';
import Tooltip from '@/components/ui/Tooltip';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

export default function AIPromptBox() {
  const router = useRouter();
  const { t } = useLocale();
  const [prompt, setPrompt] = useState('');
  const [activeFormat, setActiveFormat] = useState('excalidraw');
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Unified attachment state via useFileUpload hook
  const { attachments, payload, attachStatus, attachError, notification, closeNotification, handleFiles: handleFilesRaw, clearAttachments, removeAttachment, getSourceType, setAttachError, setAttachStatus } = useFileUpload({
    diagramFormat: activeFormat as DiagramFormat,
  });

  // 为图片附件创建 blob URL，并在 cleanup 中释放
  const imageBlobUrls = useMemo(() => {
    const urls = new Map<File, string>();
    for (const file of attachments) {
      if (file.type.startsWith('image/')) {
        urls.set(file, URL.createObjectURL(file));
      }
    }
    return urls;
  }, [attachments]);

  useEffect(() => {
    return () => {
      imageBlobUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imageBlobUrls]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }
  }, [prompt]);

  /** Core handler — wraps the hook's handleFiles with prompt */
  const handleFiles = async (files: File[]) => {
    await handleFilesRaw(files, prompt);
  };

  const { isDragging, dragHandlers } = useDragAndDrop(handleFiles);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []));
  };

  /** Clear attachments and reset file input elements */
  const clearAttachmentsLocal = () => {
    clearAttachments();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const canGenerate = (): boolean => {
    if (isGenerating) return false;
    return !!(prompt.trim() || (attachStatus === 'success' && payload));
  };

  const handleGenerate = async () => {
    if (!canGenerate()) return;
    setIsGenerating(true);

    try {
      if (attachStatus === 'success' && payload) {
        setInitData({ type: payload.type, data: payload.content, format: activeFormat as DiagramFormat });
        router.push(`/editor?source=${getSourceType()}`);
      } else if (prompt.trim()) {
        setInitData({ type: 'text', data: prompt.trim(), format: activeFormat as DiagramFormat });
        router.push('/editor?source=text');
      }
    } catch (err) {
      setAttachError((err as Error).message);
      setAttachStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const hasAttachment = attachments.length > 0;

  // Render attachment cards
  const renderAttachments = () => {
    if (attachments.length === 0) return null;

    return (
      <>
        <div className={`grid gap-2 ${attachments.length === 1 ? 'grid-cols-1' : attachments.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {attachments.map((file, i) => {
            const isImage = file.type.startsWith('image/');
            return (
              <div key={`${file.name}-${i}`} className="relative flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] group">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob URL 不支持 next/image
                  <img src={imageBlobUrls.get(file)} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[var(--surface-warm)] flex items-center justify-center flex-shrink-0">
                    <Paperclip size={13} className="text-[var(--muted)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[var(--fg)] truncate">{file.name}</p>
                  {attachStatus === 'processing' && <p className="text-[10px] text-[var(--muted)]">处理中...</p>}
                  {attachStatus === 'success' && <p className="text-[10px] text-[var(--accent-indigo)]">就绪</p>}
                  {attachStatus === 'error' && <p className="text-[10px] text-red-500">{attachError}</p>}
                </div>
                <button onClick={() => removeAttachment(i)} className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--fg)] transition-all flex-shrink-0">
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="relative rounded-3xl bg-[var(--surface-warm)] backdrop-blur-2xl border border-[var(--border)] shadow-[0_10px_60px_rgba(28,25,23,0.08)] overflow-hidden"
        {...dragHandlers}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--accent-indigo)]/5 border-2 border-dashed border-[var(--accent-indigo)]/30 rounded-3xl pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-[var(--accent-indigo)]" />
              <span className="text-sm font-medium text-[var(--accent-indigo)]">{t('prompt.dragDrop')}</span>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 pt-5 pb-3">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasAttachment ? t('prompt.placeholderAttachment') : t('prompt.placeholder')}
            rows={1}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200"
            style={{ minHeight: '48px' }}
          />

          {/* Attachments */}
          {hasAttachment && (
            <div className="mt-2 flex flex-col gap-1">
              {renderAttachments()}
            </div>
          )}

        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-4 pb-4 pt-1">
          {/* Left - Format Selector */}
          <FormatSelector value={activeFormat as DiagramFormat} onChange={(f) => setActiveFormat(f)} />

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--muted)]/40">{t('prompt.attachments')}</span>
            <input ref={fileInputRef} type="file" accept=".md,.txt" multiple className="hidden" onChange={handleFileChange} />
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            <Tooltip content={t('prompt.uploadFile')} side="top">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
                  hasAttachment && getSourceType() === 'file' ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                }`}
              >
                <Paperclip size={18} />
              </button>
            </Tooltip>
            <Tooltip content={t('prompt.uploadImage')} side="top">
              <button
                onClick={() => imageInputRef.current?.click()}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
                  hasAttachment && getSourceType() === 'image' ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                }`}
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text -- lucide Image 是 SVG 图标，不是 <img> */}
                <Image size={18} />
              </button>
            </Tooltip>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate()}
              className="h-9 px-5 flex items-center gap-2 bg-[var(--btn-primary)] text-[var(--btn-primary-text)] text-sm font-medium rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isGenerating ? (
                <><Loader2 size={15} className="animate-spin" /><span>{t('prompt.generating')}</span></>
              ) : (
                <><Sparkles size={15} /><span>{t('prompt.generate')}</span></>
              )}
            </button>
          </div>
        </div>

      </div>

      <Notification
        isOpen={notification.isOpen}
        onClose={closeNotification}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}
