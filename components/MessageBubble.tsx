'use client';

import { User, Bot, Image as ImageIcon, FileText, Type } from 'lucide-react';
import { useLocale } from '@/locales';
import type { ConversationMessage } from '@/types';

interface MessageBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SourceIcon({ sourceType }: { sourceType?: string }) {
  switch (sourceType) {
    case 'image': return <ImageIcon size={12} />;
    case 'file': return <FileText size={12} />;
    default: return <Type size={12} />;
  }
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const { t } = useLocale();
  const isUser = message.role === 'user';

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
            : 'bg-[var(--surface-warm-hover)] text-[var(--fg)] rounded-bl-md'
        }`}>
          {/* Image thumbnail for image messages */}
          {message.imageData && (
            <div className="mb-2">
              <div className="w-32 h-24 rounded-lg overflow-hidden bg-[var(--surface-warm-hover)] flex items-center justify-center">
                <img
                  src={`data:${message.imageMimeType};base64,${message.imageData}`}
                  alt="Uploaded"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

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
                <p className="text-[11px] text-[var(--muted)] mt-1">
                  {t('message.characters')} {message.content.length}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className={`flex items-center gap-1.5 mt-1 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <SourceIcon sourceType={message.sourceType} />
          <span className="text-[10px] text-[var(--muted)]">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
