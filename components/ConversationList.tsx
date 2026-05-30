'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Trash2, ChevronDown } from 'lucide-react';
import * as api from '@/lib/api-client';
import { useLocale } from '@/locales';
import { timeAgo } from '@/lib/time-ago';
import type { Conversation } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

interface ConversationListProps {
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const FORMAT_BADGES: Record<DiagramFormat, { label: string; color: string }> = {
  excalidraw: { label: 'EX', color: 'bg-purple-500/10 text-purple-600' },
  mermaid: { label: 'MM', color: 'bg-blue-500/10 text-blue-600' },
  drawio: { label: 'DX', color: 'bg-orange-500/10 text-orange-600' },
};

export default function ConversationList({ currentId, onSelect, onDelete, onNew }: ConversationListProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (isOpen) loadConversations();
  }, [isOpen]);

  const loadConversations = async () => {
    try {
      const data = await api.fetchConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.deleteConversation(id);
    onDelete(id);
    await loadConversations();
  };

  const current = conversations.find(c => c.id === currentId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-lg transition-all duration-200"
      >
        <MessageSquare size={13} />
        <span className="max-w-[120px] truncate">{current?.title || t('conversation.list')}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-[var(--surface-warm)] backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-[0_10px_40px_rgba(28,25,23,0.10)] overflow-hidden animate-slide-up">
            {/* New chat button */}
            <button
              onClick={() => { onNew(); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 transition-colors border-b border-black/5"
            >
              <MessageSquare size={14} />
              {t('conversation.new')}
            </button>

            {/* List */}
            <div className="max-h-64 overflow-y-auto scrollbar-thin">
              {conversations.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">{t('conversation.empty')}</div>
              ) : (
                conversations.map((conv) => {
                  const badge = FORMAT_BADGES[conv.format] || FORMAT_BADGES.excalidraw;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => { onSelect(conv.id); setIsOpen(false); }}
                      className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        conv.id === currentId ? 'bg-[var(--accent-indigo)]/5' : 'hover:bg-[var(--surface-warm-hover)]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-sm text-[var(--fg)] truncate">{conv.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                          <span>{conv.messageCount} {t('conversation.messages')}</span>
                          <span>{timeAgo(conv.updatedAt, t)}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
