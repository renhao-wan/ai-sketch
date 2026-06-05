'use client';

import React, { useState, useRef, useCallback } from 'react';
import { User, Bot, RefreshCw, Copy, Download, Check, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import { parseStoredImages } from '@/lib/utils';
import Tooltip from '@/components/ui/Tooltip';
import type { ConversationMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onCopy?: () => void;
  onExport?: () => void;
  onShowDiagram?: () => void;
}

const MessageBubble = React.memo(function MessageBubble({ message, isStreaming, onRegenerate, onCopy, onExport, onShowDiagram }: MessageBubbleProps) {
  const { t } = useLocale();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CODE_PREVIEW_LENGTH = 300;
  const isLongCode = !isUser && message.content.length > CODE_PREVIEW_LENGTH;

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
        <Tooltip content={t('copilot.regenerate')} side="top">
          <button onClick={onRegenerate} className="flex items-center justify-center w-5 h-5 text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 rounded transition-all duration-200">
            <RefreshCw size={11} />
          </button>
        </Tooltip>
      )}
      {onCopy && (
        <Tooltip content={t('copilot.copy')} side="top">
          <button onClick={handleCopy} className={`flex items-center justify-center w-5 h-5 rounded transition-all duration-200 ${copied ? 'text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5'}`}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </Tooltip>
      )}
      {onExport && (
        <Tooltip content={t('copilot.export')} side="top">
          <button onClick={onExport} className="flex items-center justify-center w-5 h-5 text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 rounded transition-all duration-200">
            <Download size={11} />
          </button>
        </Tooltip>
      )}
      {onShowDiagram && (
        <Tooltip content={t('copilot.showDiagram')} side="top">
          <button onClick={onShowDiagram} className="flex items-center justify-center w-5 h-5 text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 rounded transition-all duration-200">
            <Play size={11} />
          </button>
        </Tooltip>
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URL 不支持 next/image */}
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

              {/* 收起状态：显示友好的提示卡片 */}
              {!expanded ? (
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--surface-warm-hover)] rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent-indigo)]/30 hover:bg-[var(--accent-indigo)]/5 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--muted)] group-hover:text-[var(--accent-indigo)] transition-colors">
                      {t('message.clickToExpand')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--muted)]/70">
                      {message.content.length} {t('message.characters')}
                    </span>
                    <ChevronDown size={14} className="text-[var(--muted)] group-hover:text-[var(--accent-indigo)] transition-colors" />
                  </div>
                </button>
              ) : (
                <>
                  {/* 展开状态：显示代码预览 */}
                  <pre className="text-xs font-mono bg-[var(--surface-warm-hover)] rounded-lg p-2.5 overflow-x-auto max-h-40 scrollbar-thin">
                    <code>{isLongCode ? message.content.substring(0, CODE_PREVIEW_LENGTH) + '...' : message.content}</code>
                  </pre>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => setExpanded(false)}
                      className="flex items-center gap-1 text-[11px] text-[var(--accent-indigo)] hover:text-[var(--accent-indigo)]/80 transition-colors duration-200"
                    >
                      <ChevronUp size={12} />
                      {t('message.collapse')}
                    </button>
                    <span className="text-[11px] text-[var(--muted)]/70">
                      {message.content.length} {t('message.characters')}
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between mt-1">
                <div />
                {actionButtons}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;
