'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { User, Bot, RefreshCw, Copy, Download, Check, Play } from 'lucide-react';
import { useLocale } from '@/locales';
import { parseStoredImages } from '@/lib/utils';
import type { ConversationMessage } from '@/types';

interface MessageBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onCopy?: () => void;
  onExport?: () => void;
  onShowDiagram?: () => void;
}

export default function MessageBubble({ message, isStreaming, onRegenerate, onCopy, onExport, onShowDiagram }: MessageBubbleProps) {
  const { t } = useLocale();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    if (!onCopy) return;
    onCopy();
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [onCopy]);

  const hasActions = onRegenerate || onCopy || onExport || onShowDiagram;
  const actionButtons = hasActions ? (
    <div className="flex items-center gap-0.5">
      {onRegenerate && (
        <button onClick={onRegenerate} className="flex items-center justify-center w-5 h-5 text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 rounded transition-all duration-200" title={t('copilot.regenerate')}>
          <RefreshCw size={11} />
        </button>
      )}
      {onCopy && (
        <button onClick={handleCopy} className={`flex items-center justify-center w-5 h-5 rounded transition-all duration-200 ${copied ? 'text-emerald-500' : 'text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5'}`} title={t('copilot.copy')}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      )}
      {onExport && (
        <button onClick={onExport} className="flex items-center justify-center w-5 h-5 text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 rounded transition-all duration-200" title={t('copilot.export')}>
          <Download size={11} />
        </button>
      )}
      {onShowDiagram && (
        <button onClick={onShowDiagram} className="flex items-center justify-center w-5 h-5 text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 rounded transition-all duration-200" title={t('copilot.showDiagram')}>
          <Play size={11} />
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center ${
        isUser
          ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]'
          : 'bg-[var(--surface-warm-hover)] text-[var(--muted)]'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Content */}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--accent-indigo)] text-white rounded-br-md'
            : 'bg-[var(--surface-warm)] text-[var(--fg)] rounded-bl-md border border-[var(--border)]'
        }`}>
          {/* Image thumbnail(s) for image messages */}
          {message.imageData && (() => {
            const images = parseStoredImages(message.imageData, message.imageMimeType);
            if (images.length === 0) return null;
            return (
              <div className={`mb-2 flex gap-1.5 flex-wrap ${images.length > 1 ? 'max-w-48' : ''}`}>
                {images.slice(0, 3).map((img, i) => (
                  <div key={i} className="w-20 h-16 rounded-lg overflow-hidden bg-[var(--surface-warm-hover)] flex items-center justify-center">
                    <img
                      src={`data:${img.mimeType};base64,${img.data}`}
                      alt={`Uploaded ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Text content */}
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">{t('message.generatedCode')}</span>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-indigo)] animate-pulse" />
                )}
              </div>
              <pre className="text-xs font-mono bg-[var(--surface-warm-hover)] rounded-lg p-2.5 overflow-x-auto max-h-40 scrollbar-thin">
                <code>{message.content.length > 300 ? message.content.substring(0, 300) + '...' : message.content}</code>
              </pre>
              {message.content.length > 300 && (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-[var(--muted)]">
                    {message.content.length} {t('message.characters')}
                  </p>
                  {actionButtons}
                </div>
              )}
              {message.content.length <= 300 && actionButtons && (
                <div className="flex items-center justify-end mt-1">
                  {actionButtons}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
