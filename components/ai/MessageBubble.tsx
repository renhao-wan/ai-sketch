'use client';

import { User, Bot } from 'lucide-react';
import { useLocale } from '@/locales';
import type { ConversationMessage } from '@/types';

interface MessageBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
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
            : 'bg-[var(--surface-warm)] text-[var(--fg)] rounded-bl-md border border-[var(--border)]'
        }`}>
          {/* Image thumbnail(s) for image messages */}
          {message.imageData && (() => {
            // 解析图片数据：单图或多图 JSON 数组
            const images: { data: string; mimeType: string }[] = [];
            if (message.imageMimeType === 'application/json') {
              try { images.push(...JSON.parse(message.imageData)); } catch { /* ignore */ }
            } else {
              images.push({ data: message.imageData, mimeType: message.imageMimeType || 'image/png' });
            }
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
                <p className="text-[11px] text-[var(--muted)] mt-1">
                  {message.content.length} {t('message.characters')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
