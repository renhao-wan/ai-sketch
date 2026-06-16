'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { User, Bot, RefreshCw, Copy, Download, Check, Play, ChevronDown, ChevronUp, Pencil, Send, X } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import { parseStoredImages } from '@/lib/utils';
import Tooltip from '@/components/ui/Tooltip';
import type { ConversationMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
  highlightQuery?: string;
  onRegenerate?: () => void;
  onCopy?: () => void;
  onExport?: () => void;
  onShowDiagram?: () => void;
  onEdit?: (newContent: string) => void;
}

/** 将文本中匹配搜索关键词的子串用 <mark> 高亮 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    if (idx > lastIdx) parts.push(text.slice(lastIdx, idx));
    parts.push(<mark key={idx} className="bg-yellow-200/60 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>);
    lastIdx = idx + query.length;
    idx = lower.indexOf(q, lastIdx);
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 0 ? parts : text;
}

/** 用户消息内容，长文本自动收起 */
const USER_TEXT_LIMIT = 50;

function UserContent({ content, highlightQuery, onExpandChange }: { content: string; highlightQuery?: string; onExpandChange?: (expanded: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > USER_TEXT_LIMIT;

  const toggle = useCallback(() => {
    setExpanded(prev => {
      onExpandChange?.(!prev);
      return !prev;
    });
  }, [onExpandChange]);

  if (!isLong) {
    return <p className="whitespace-pre-wrap break-words text-white">{highlightText(content, highlightQuery || '')}</p>;
  }

  // 用户气泡背景是紫色（accent-indigo），按钮文字用白色系确保可见
  return (
    <div>
      <p className="whitespace-pre-wrap break-words text-white">
        {highlightText(expanded ? content : content.substring(0, USER_TEXT_LIMIT) + '...', highlightQuery || '')}
      </p>
      <button
        onClick={toggle}
        className="mt-1 text-[11px] text-white/80 hover:text-white transition-colors cursor-pointer"
      >
        {expanded ? '收起' : '展开全部'}
      </button>
    </div>
  );
}

const MessageBubble = React.memo(function MessageBubble({ message, isStreaming, highlightQuery, onRegenerate, onCopy, onExport, onShowDiagram, onEdit }: MessageBubbleProps) {
  const { t } = useLocale();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isExpanded, setIsExpanded] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CODE_PREVIEW_LENGTH = 300;

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  const isLongCode = !isUser && message.content.length > CODE_PREVIEW_LENGTH;

  const handleCopy = useCallback(() => {
    if (!onCopy) return;
    onCopy();
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [onCopy]);

  // 编辑模式处理
  const handleStartEdit = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
    requestAnimationFrame(() => editRef.current?.focus());
  }, [message.content]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  const handleSubmitEdit = useCallback(() => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) { setIsEditing(false); return; }
    onEdit?.(trimmed);
    setIsEditing(false);
  }, [editContent, message.content, onEdit]);

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
        {/* 编辑模式 — 保留气泡外壳，内部替换为 textarea */}
        {isUser && isEditing ? (
          <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[var(--accent-indigo)] text-sm leading-relaxed">
            <textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitEdit(); }
                if (e.key === 'Escape') handleCancelEdit();
              }}
              onBlur={() => { setTimeout(handleCancelEdit, 150); }}
              rows={Math.max(2, editContent.split('\n').length)}
              style={{
                width: '100%',
                fontSize: '0.875rem',
                lineHeight: '1.625',
                color: 'white',
                background: 'rgba(255,255,255,0.12)',
                resize: 'none',
                outline: 'none',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                padding: '6px 8px',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '8px',
                letterSpacing: 'inherit',
                transition: 'none',
                WebkitTransition: 'none',
              }}
            />
            <div className="flex items-center gap-1.5 justify-end mt-1.5">
              <button onClick={handleCancelEdit} className="flex items-center gap-1 px-2 py-1 text-[11px] text-white/70 hover:text-white rounded transition-colors">
                <X size={12} />{t('common.cancel')}
              </button>
              <button onClick={handleSubmitEdit} className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--accent-indigo)] bg-white hover:bg-white/90 rounded transition-colors font-medium">
                <Send size={12} />{t('copilot.send')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? 'bg-[var(--accent-indigo)] text-white rounded-br-md'
                : 'bg-[var(--surface-warm)] text-[var(--fg)] rounded-bl-md border border-[var(--border)]'
            }`}>
              {/* Image thumbnail(s) */}
              {message.imageData && (() => {
                const images = parseStoredImages(message.imageData, message.imageMimeType);
                if (images.length === 0) return null;
                return (
                  <div className={`mb-2 flex gap-1.5 flex-wrap ${images.length > 1 ? 'max-w-48' : ''}`}>
                    {images.slice(0, 3).map((img, i) => (
                      <div key={i} className="w-20 h-16 rounded-lg overflow-hidden bg-[var(--surface-warm-hover)] flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URL 不支持 next/image */}
                        <img src={`data:${img.mimeType};base64,${img.data}`} alt={`Uploaded ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Text content */}
              {isUser ? (
                <UserContent content={message.content} highlightQuery={highlightQuery} onExpandChange={setIsExpanded} />
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">{t('message.generatedCode')}</span>
                    {isStreaming && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-indigo)] animate-pulse" />}
                  </div>
                  {!expanded ? (
                    <button onClick={() => setExpanded(true)} className="w-full flex items-center gap-2 px-3.5 py-2.5 bg-[var(--surface-warm-hover)] rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent-indigo)]/30 hover:bg-[var(--accent-indigo)]/5 transition-all duration-200 group">
                      <span className="text-xs text-[var(--muted)] group-hover:text-[var(--accent-indigo)] transition-colors">{t('message.clickToExpand')}</span>
                      <span className="text-[11px] text-[var(--muted)]/70">{message.content.length} {t('message.characters')}</span>
                      <ChevronDown size={14} className="text-[var(--muted)] group-hover:text-[var(--accent-indigo)] transition-colors ml-auto" />
                    </button>
                  ) : (
                    <>
                      <pre className="text-xs font-mono bg-[var(--surface-warm-hover)] rounded-lg p-2.5 overflow-x-auto max-h-40 scrollbar-thin">
                        <code>{highlightText(isLongCode ? message.content.substring(0, CODE_PREVIEW_LENGTH) + '...' : message.content, highlightQuery || '')}</code>
                      </pre>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button onClick={() => setExpanded(false)} className="flex items-center gap-1 text-[11px] text-[var(--accent-indigo)] hover:text-[var(--accent-indigo)]/80 transition-colors duration-200">
                          <ChevronUp size={12} />{t('message.collapse')}
                        </button>
                        <span className="text-[11px] text-[var(--muted)]/70">{message.content.length} {t('message.characters')}</span>
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

            {/* 用户消息编辑按钮 — 气泡外部右下角（展开时隐藏，避免与收起按钮冲突） */}
            {isUser && onEdit && !isExpanded && (
              <div className="flex justify-end mt-1">
                <Tooltip content={t('copilot.editMessage')} side="top">
                  <button onClick={handleStartEdit} className="flex items-center justify-center w-5 h-5 text-[var(--muted)] hover:text-[var(--accent-indigo)] rounded transition-colors">
                    <Pencil size={11} />
                  </button>
                </Tooltip>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
