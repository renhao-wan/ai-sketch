'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit3, Trash2, X, Check, Search } from 'lucide-react';
import * as api from '@/lib/api/client';
import { useNotification } from '@/lib/contexts/NotificationContext';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import ScrollToTop from '@/components/ui/ScrollToTop';
import { useLocale } from '@/lib/locales';
import type { ConversationTag, ConfigTag, ConfirmDialogState } from '@/lib/types';

/** 预设颜色 */
const PRESET_COLORS = [
  { value: '#6366f1', name: '靛蓝' },
  { value: '#8b5cf6', name: '紫色' },
  { value: '#ec4899', name: '粉色' },
  { value: '#f43f5e', name: '红色' },
  { value: '#f97316', name: '橙色' },
  { value: '#eab308', name: '黄色' },
  { value: '#22c55e', name: '绿色' },
  { value: '#06b6d4', name: '青色' },
];

/** 标签管理组件 */
export function TagSettings({ isVisible = true }: { isVisible?: boolean } = {}) {
  const { t } = useLocale();
  const { showNotification } = useNotification();

  // 对话标签状态
  const [conversationTags, setConversationTags] = useState<ConversationTag[]>([]);
  const [editingConvTag, setEditingConvTag] = useState<Partial<ConversationTag> | null>(null);
  const [isCreatingConvTag, setIsCreatingConvTag] = useState(false);
  const [convSearch, setConvSearch] = useState('');

  // 配置标签状态
  const [configTags, setConfigTags] = useState<ConfigTag[]>([]);
  const [editingConfigTag, setEditingConfigTag] = useState<Partial<ConfigTag> | null>(null);
  const [isCreatingConfigTag, setIsCreatingConfigTag] = useState(false);
  const [configSearch, setConfigSearch] = useState('');

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  // 加载标签
  const loadTags = async () => {
    try {
      const [convTags, cfgTags] = await Promise.all([
        api.fetchConversationTags(),
        api.fetchConfigTags(),
      ]);
      setConversationTags(convTags);
      setConfigTags(cfgTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 仅在挂载时加载标签
  useEffect(() => { loadTags(); }, []);

  // 当组件变为不可见时，关闭所有编辑状态
  useEffect(() => {
    if (!isVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 组件不可见时重置状态是合理的
      setEditingConvTag(null);
      setIsCreatingConvTag(false);
      setEditingConfigTag(null);
      setIsCreatingConfigTag(false);
    }
  }, [isVisible]);

  // 过滤后的标签列表
  const filteredConvTags = useMemo(() => {
    if (!convSearch.trim()) return conversationTags;
    const q = convSearch.trim().toLowerCase();
    return conversationTags.filter(tag => tag.name.toLowerCase().includes(q));
  }, [conversationTags, convSearch]);

  const filteredConfigTags = useMemo(() => {
    if (!configSearch.trim()) return configTags;
    const q = configSearch.trim().toLowerCase();
    return configTags.filter(tag => tag.name.toLowerCase().includes(q));
  }, [configTags, configSearch]);

  // ==================== 对话标签操作 ====================

  const handleCreateConvTag = () => {
    setIsCreatingConvTag(true);
    setEditingConvTag({ name: '', color: PRESET_COLORS[0].value });
  };

  const handleSaveConvTag = async () => {
    if (!editingConvTag?.name?.trim()) {
      showNotification(t('tags.createSuccess'), t('tags.nameRequired'), 'error');
      return;
    }

    if (editingConvTag.name.length > 20) {
      showNotification(t('tags.createSuccess'), t('tags.nameTooLong'), 'error');
      return;
    }

    // 前端同名检查
    if (isCreatingConvTag && conversationTags.some(t => t.name === editingConvTag.name!.trim())) {
      showNotification(t('tags.createSuccess'), t('tags.duplicateName'), 'error');
      return;
    }

    try {
      if (isCreatingConvTag) {
        await api.createConversationTag({
          name: editingConvTag.name.trim(),
          color: editingConvTag.color || PRESET_COLORS[0].value,
        });
        showNotification(t('tags.createSuccess'), '', 'success');
      } else {
        await api.updateConversationTag(editingConvTag.id!, {
          name: editingConvTag.name.trim(),
          color: editingConvTag.color,
        });
        showNotification(t('tags.updateSuccess'), '', 'success');
      }
      setEditingConvTag(null);
      setIsCreatingConvTag(false);
      await loadTags();
    } catch (err) {
      showNotification(t('tags.createSuccess'), (err as Error).message, 'error');
    }
  };

  const handleDeleteConvTag = (tag: ConversationTag) => {
    setConfirmDialog({
      isOpen: true,
      title: t('tags.confirmDelete'),
      message: t('tags.confirmDeleteMsg'),
      onConfirm: async () => {
        try {
          await api.deleteConversationTag(tag.id);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          showNotification(t('tags.deleteSuccess'), '', 'success');
          await loadTags();
        } catch (err) {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          showNotification(t('tags.deleteSuccess'), (err as Error).message, 'error');
        }
      },
    });
  };

  // ==================== 配置标签操作 ====================

  const handleCreateConfigTag = () => {
    setIsCreatingConfigTag(true);
    setEditingConfigTag({ name: '', color: PRESET_COLORS[0].value });
  };

  const handleSaveConfigTag = async () => {
    if (!editingConfigTag?.name?.trim()) {
      showNotification(t('tags.createSuccess'), t('tags.nameRequired'), 'error');
      return;
    }

    if (editingConfigTag.name.length > 20) {
      showNotification(t('tags.createSuccess'), t('tags.nameTooLong'), 'error');
      return;
    }

    // 前端同名检查
    if (isCreatingConfigTag && configTags.some(t => t.name === editingConfigTag.name!.trim())) {
      showNotification(t('tags.createSuccess'), t('tags.duplicateName'), 'error');
      return;
    }

    try {
      if (isCreatingConfigTag) {
        await api.createConfigTag({
          name: editingConfigTag.name.trim(),
          color: editingConfigTag.color || PRESET_COLORS[0].value,
        });
        showNotification(t('tags.createSuccess'), '', 'success');
      } else {
        await api.updateConfigTag(editingConfigTag.id!, {
          name: editingConfigTag.name.trim(),
          color: editingConfigTag.color,
        });
        showNotification(t('tags.updateSuccess'), '', 'success');
      }
      setEditingConfigTag(null);
      setIsCreatingConfigTag(false);
      await loadTags();
    } catch (err) {
      showNotification(t('tags.createSuccess'), (err as Error).message, 'error');
    }
  };

  const handleDeleteConfigTag = (tag: ConfigTag) => {
    setConfirmDialog({
      isOpen: true,
      title: t('tags.confirmDelete'),
      message: t('tags.confirmDeleteMsg'),
      onConfirm: async () => {
        try {
          await api.deleteConfigTag(tag.id);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          showNotification(t('tags.deleteSuccess'), '', 'success');
          await loadTags();
        } catch (err) {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          showNotification(t('tags.deleteSuccess'), (err as Error).message, 'error');
        }
      },
    });
  };

  // 渲染标签编辑浮层
  const renderTagModal = (
    editingTag: Partial<ConversationTag> | Partial<ConfigTag> | null,
    isCreating: boolean,
    setEditingTag: (tag: Partial<ConversationTag> | Partial<ConfigTag> | null) => void,
    setIsCreating: (v: boolean) => void,
    handleSave: () => void,
    accentColor: string,
  ) => {
    if (!editingTag) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={() => { setEditingTag(null); setIsCreating(false); }}
      >
        <div
          className="w-full max-w-sm mx-4 p-5 rounded-2xl bg-[var(--surface-warm)] border border-[var(--border)] shadow-2xl space-y-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--fg)]">
              {isCreating ? t('tags.create') : t('tags.edit')}
            </span>
            <button
              onClick={() => { setEditingTag(null); setIsCreating(false); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
            >
              <X size={14} />
            </button>
          </div>

          <input
            type="text"
            value={editingTag.name || ''}
            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
            placeholder={t('tags.namePlaceholder')}
            maxLength={20}
            autoFocus
            className="w-full px-3 py-2.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30"
          />

          <div>
            <label className="block text-xs text-[var(--muted)] mb-2">{t('tags.color')}</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => setEditingTag({ ...editingTag, color: color.value })}
                  className={`w-8 h-8 rounded-full transition-all duration-200 ${
                    editingTag.color === color.value
                      ? 'ring-2 ring-offset-2 ring-[var(--accent-indigo)] scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200 font-medium"
            style={{ backgroundColor: accentColor }}
          >
            <Check size={14} />
            {isCreating ? t('common.create') : t('common.save')}
          </button>
        </div>
      </div>
    );
  };

  // 渲染标签列表区块
  const renderTagSection = (
    tags: ConversationTag[] | ConfigTag[],
    filteredTags: ConversationTag[] | ConfigTag[],
    type: 'conversation' | 'config',
    search: string,
    setSearch: (v: string) => void,
    accentColor: string,
  ) => {
    const editingTag = type === 'conversation' ? editingConvTag : editingConfigTag;
    const isCreating = type === 'conversation' ? isCreatingConvTag : isCreatingConfigTag;
    const setEditingTag = type === 'conversation' ? setEditingConvTag : setEditingConfigTag;
    const setIsCreating = type === 'conversation' ? setIsCreatingConvTag : setIsCreatingConfigTag;
    const handleSave = type === 'conversation' ? handleSaveConvTag : handleSaveConfigTag;
    const handleDelete = type === 'conversation' ? handleDeleteConvTag : handleDeleteConfigTag;
    const handleCreate = type === 'conversation' ? handleCreateConvTag : handleCreateConfigTag;

    return (
      <div className="space-y-3">
        {/* 顶部：搜索 + 新建按钮 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('tags.search')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-warm)] border border-[var(--border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20"
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white rounded-xl transition-all duration-200 font-medium hover:opacity-90 active:scale-[0.98] shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            <Plus size={14} />
            {t('tags.create')}
          </button>
        </div>

        {/* 标签列表 */}
        <ScrollToTop className="max-h-96 overflow-y-auto scrollbar-thin">
          <div className="space-y-2">
            {filteredTags.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--muted)]">
                {search.trim() ? t('tags.noResults') : t('tags.noTags')}
              </div>
            ) : (
              filteredTags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-warm-hover)] hover:bg-[var(--border)] transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-[var(--fg)]">{tag.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingTag({ ...tag });
                        setIsCreating(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-all duration-200"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollToTop>
      </div>
    );
  };

  const hasModal = editingConvTag || editingConfigTag;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 对话标签 */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-indigo)]" />
              {t('tags.conversationTags')}
              <span className="text-[var(--muted)] font-normal">({conversationTags.length})</span>
            </h3>
            {renderTagSection(
              conversationTags, filteredConvTags, 'conversation',
              convSearch, setConvSearch, '#6366f1',
            )}
          </div>

          {/* 配置标签 */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)]" />
              {t('tags.configTags')}
              <span className="text-[var(--muted)] font-normal">({configTags.length})</span>
            </h3>
            {renderTagSection(
              configTags, filteredConfigTags, 'config',
              configSearch, setConfigSearch, '#06b6d4',
            )}
          </div>
        </div>
      </div>

      {/* 编辑/创建浮层 */}
      {hasModal && (
        editingConvTag
          ? renderTagModal(editingConvTag, isCreatingConvTag, setEditingConvTag, setIsCreatingConvTag, handleSaveConvTag, '#6366f1')
          : renderTagModal(editingConfigTag, isCreatingConfigTag, setEditingConfigTag, setIsCreatingConfigTag, handleSaveConfigTag, '#06b6d4')
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm ?? (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
}
