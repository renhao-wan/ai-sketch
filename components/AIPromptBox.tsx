'use client';

import { useState, useRef, useEffect, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
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
import { setInitData } from '@/lib/init-data';
import { useLocale } from '@/locales';
import { useFileUpload } from '@/composables/useFileUpload';
import type { DiagramFormat } from '@/types/diagram-strategy';

const FORMATS = [
  { key: 'excalidraw', label: 'Excalidraw' },
  { key: 'mermaid', label: 'Mermaid' },
  { key: 'drawio', label: 'Draw.io' },
];

export default function AIPromptBox() {
  const router = useRouter();
  const { t } = useLocale();
  const [prompt, setPrompt] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const [activeFormat, setActiveFormat] = useState('excalidraw');
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Unified attachment state via useFileUpload hook
  const { attachments, payload, attachStatus, attachError, handleFiles: handleFilesRaw, clearAttachments, getSourceType, setAttachError, setAttachStatus } = useFileUpload({
    diagramFormat: activeFormat as DiagramFormat,
  });

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

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const hasAttachment = attachments.length > 0;

  // Render attachment chips
  const renderAttachments = () => {
    if (attachments.length === 0) return null;

    // Single file — show details
    if (attachments.length === 1) {
      const file = attachments[0];
      const isImage = file.type.startsWith('image/');
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)]">
          {attachStatus === 'processing' && <Loader2 size={13} className="animate-spin text-[var(--muted)] flex-shrink-0" />}
          {attachStatus === 'success' && <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />}
          {attachStatus === 'error' && <AlertCircle size={13} className="text-red-500 flex-shrink-0" />}
          {isImage && <Image size={13} className="text-[var(--muted)] flex-shrink-0" />}
          {!isImage && <Paperclip size={13} className="text-[var(--muted)] flex-shrink-0" />}
          <span className="text-xs text-[var(--fg)] truncate flex-1">{file.name}</span>
          {attachStatus === 'error' && <span className="text-[10px] text-red-500 flex-shrink-0">{attachError}</span>}
          <button onClick={clearAttachmentsLocal} className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex-shrink-0 ml-1">
            <X size={13} />
          </button>
        </div>
      );
    }

    // Multiple files — show count
    const imageCount = attachments.filter(f => f.type.startsWith('image/')).length;
    const fileCount = attachments.length - imageCount;
    const parts: string[] = [];
    if (imageCount > 0) parts.push(`${imageCount} ${t('prompt.imageCount')}`);
    if (fileCount > 0) parts.push(`${fileCount} ${t('prompt.fileCount')}`);

    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)]">
        {attachStatus === 'processing' && <Loader2 size={13} className="animate-spin text-[var(--muted)] flex-shrink-0" />}
        {attachStatus === 'success' && <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />}
        {attachStatus === 'error' && <AlertCircle size={13} className="text-red-500 flex-shrink-0" />}
        <span className="text-xs text-[var(--fg)] truncate flex-1">{parts.join(' + ')}</span>
        {attachStatus === 'error' && <span className="text-[10px] text-red-500 flex-shrink-0">{attachError}</span>}
        <button onClick={clearAttachmentsLocal} className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex-shrink-0 ml-1">
          <X size={13} />
        </button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="relative rounded-3xl bg-[var(--surface-warm)] backdrop-blur-2xl border border-[var(--border)] shadow-[0_10px_60px_rgba(28,25,23,0.08)] overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none"
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
          <div className="segmented-control">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFormat(f.key)}
                className={`segmented-control-item ${activeFormat === f.key ? 'active' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--muted)]/40">{t('prompt.attachments')}</span>
            <input ref={fileInputRef} type="file" accept=".md,.txt" multiple className="hidden" onChange={handleFileChange} />
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
                hasAttachment && getSourceType() === 'file' ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
              title={t('prompt.uploadFile')}
            >
              <Paperclip size={18} />
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
                hasAttachment && getSourceType() === 'image' ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
              title={t('prompt.uploadImage')}
            >
              <Image size={18} />
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate()}
              className="h-9 px-5 flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
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
    </div>
  );
}
