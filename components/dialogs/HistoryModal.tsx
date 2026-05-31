'use client';

import { useState, useEffect, useRef } from 'react';
import * as api from '@/lib/api-client';
import ConfirmDialog from './ConfirmDialog';
import ScrollToTop from '../ScrollToTop';
import { useLocale } from '@/locales';
import { Trash2, Clock, ArrowRight, Pencil, Check, X } from 'lucide-react';
import type { Conversation, ConfirmDialogState } from '@/types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (conversation: Conversation) => void;
}

export default function HistoryModal({ isOpen, onClose, onApply }: HistoryModalProps) {
  const { t } = useLocale();
  const [items, setItems] = useState<Conversation[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, title: '', message: '', onConfirm: null });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isOpen) loadConversations(); }, [isOpen]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const loadConversations = async () => {
    try {
      const data = await api.fetchConversations();
      setItems(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const handleApply = (item: Conversation) => { onApply?.(item); onClose(); };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      isOpen: true, title: t('history.confirmDelete'), message: t('history.confirmDeleteMsg'),
      onConfirm: async () => {
        await api.deleteConversation(id);
        await loadConversations();
      },
    });
  };

  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true, title: t('history.confirmClear'), message: t('history.confirmClearMsg'),
      onConfirm: async () => {
        await api.clearAllConversations();
        await loadConversations();
      },
    });
  };

  const handleRenameStart = (e: React.MouseEvent, item: Conversation) => {
    e.stopPropagation();
    setRenamingId(item.id);
    setRenameValue(item.title);
  };

  const handleRenameSave = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    await api.updateConversationTitle(renamingId, renameValue.trim());
    setRenamingId(null);
    await loadConversations();
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSave();
    if (e.key === 'Escape') setRenamingId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[var(--muted)]" />
            <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">{t('history.title')}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Fixed Clear Button */}
        {items.length > 0 && (
          <div className="px-7 pb-3 flex-shrink-0">
            <button onClick={handleClearAll} className="px-4 py-2 text-xs text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all duration-200">
              {t('history.clearAll')}
            </button>
          </div>
        )}

        {/* Scrollable List */}
        <ScrollToTop className="px-7 pb-6 scrollbar-thin">
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="text-center py-12 text-sm text-[var(--muted)]">{t('history.empty')}</div>
            ) : (
              items.map((item) => {
                const isRenaming = renamingId === item.id;
                return (
                <div key={item.id} className="group p-4 rounded-2xl bg-black/[0.03] hover:bg-black/[0.05] border border-transparent hover:border-black/[0.06] transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 text-[11px] font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded-lg">
                          {item.format}
                        </span>
                        <span className="text-[11px] text-[var(--muted)]">
                          {new Date(item.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      {isRenaming ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            className="flex-1 min-w-0 text-sm text-[var(--fg)] bg-white border border-[var(--accent-indigo)]/30 rounded-lg px-3 py-1.5 outline-none focus:border-[var(--accent-indigo)] focus:ring-2 focus:ring-[var(--accent-indigo)]/10"
                          />
                          <button onClick={handleRenameSave} className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setRenamingId(null)} className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-lg transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--fg)] mb-1">{item.title}</p>
                      )}
                      {item.configName && <p className="text-[11px] text-[var(--muted)]">{t('history.modelPrefix')} {item.configName} - {item.configModel}</p>}
                    </div>
                    {!isRenaming && (
                      <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button onClick={() => handleApply(item)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 rounded-lg transition-colors">
                          <ArrowRight size={13} /><span>{t('history.apply')}</span>
                        </button>
                        <button onClick={(e) => handleRenameStart(e, item)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-lg transition-colors" title={t('conversation.rename')}>
                          <Pencil size={13} /><span>{t('conversation.rename')}</span>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} /><span>{t('common.delete')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );
              })
            )}
          </div>
        </ScrollToTop>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => { confirmDialog.onConfirm?.(); setConfirmDialog({ ...confirmDialog, isOpen: false }); }}
        title={confirmDialog.title} message={confirmDialog.message} type="danger"
      />
    </div>
  );
}
