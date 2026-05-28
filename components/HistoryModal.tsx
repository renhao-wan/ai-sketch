'use client';

import { useState, useEffect } from 'react';
import * as api from '@/lib/api-client';
import { CHART_TYPES } from '@/lib/constants';
import ConfirmDialog from './ConfirmDialog';
import ScrollToTop from './ScrollToTop';
import { Trash2, Clock, ArrowRight } from 'lucide-react';
import type { HistoryItem, ConfirmDialogState } from '@/types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (history: HistoryItem) => void;
}

export default function HistoryModal({ isOpen, onClose, onApply }: HistoryModalProps) {
  const [histories, setHistories] = useState<HistoryItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => { if (isOpen) loadHistories(); }, [isOpen]);

  const loadHistories = async () => {
    try {
      const data = await api.fetchHistories();
      setHistories(data);
    } catch (err) {
      console.error('Failed to load histories:', err);
    }
  };

  const handleApply = (history: HistoryItem) => { onApply?.(history); onClose(); };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      isOpen: true, title: '确认删除', message: '确定要删除这条历史记录吗？',
      onConfirm: async () => {
        await api.deleteHistory(id);
        await loadHistories();
      },
    });
  };

  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true, title: '确认清空', message: '确定要清空所有历史记录吗？此操作不可恢复。',
      onConfirm: async () => {
        await api.clearAllHistory();
        await loadHistories();
      },
    });
  };

  const truncateText = (text: string | { text?: string }, maxLength = 100): string => {
    if (!text) return '';
    if (typeof text === 'object') return text.text || '图片上传生成';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-[0_20px_60px_rgba(15,23,42,0.12)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[var(--muted)]" />
            <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">历史记录</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Fixed Clear Button */}
        {histories.length > 0 && (
          <div className="px-7 pb-3 flex-shrink-0">
            <button onClick={handleClearAll} className="px-4 py-2 text-xs text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all duration-200">
              清空全部
            </button>
          </div>
        )}

        {/* Scrollable List */}
        <ScrollToTop className="px-7 pb-6 scrollbar-thin">
          <div className="space-y-2">
            {histories.length === 0 ? (
              <div className="text-center py-12 text-sm text-[var(--muted)]">暂无历史记录</div>
            ) : (
              histories.map((history) => (
                <div key={history.id} className="group p-4 rounded-2xl bg-black/3 hover:bg-black/5 border border-transparent hover:border-black/5 transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 text-[11px] font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded-lg">
                          {CHART_TYPES[history.chartType as keyof typeof CHART_TYPES] || history.chartType}
                        </span>
                        <span className="text-[11px] text-[var(--muted)]">
                          {new Date(history.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--fg)] mb-1">{truncateText(history.userInput)}</p>
                      {history.config && <p className="text-[11px] text-[var(--muted)]">模型: {history.config.name} - {history.config.model}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => handleApply(history)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-lg transition-all duration-200">
                        <ArrowRight size={12} /><span>应用</span>
                      </button>
                      <button onClick={() => handleDelete(history.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all duration-200">
                        <Trash2 size={12} /><span>删除</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
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
