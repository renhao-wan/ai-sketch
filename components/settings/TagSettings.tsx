'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, X, Check } from 'lucide-react';
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

  // 配置标签状态
  const [configTags, setConfigTags] = useState<ConfigTag[]>([]);
  const [editingConfigTag, setEditingConfigTag] = useState<Partial<ConfigTag> | null>(null);
  const [isCreatingConfigTag, setIsCreatingConfigTag] = useState(false);

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

    try {
      if (isCreatingConvTag) {
        await api.createConversationTag({
          name: editingConvTag.name,
          color: editingConvTag.color || PRESET_COLORS[0].value,
        });
        showNotification(t('tags.createSuccess'), '', 'success');
      } else {
        await api.updateConversationTag(editingConvTag.id!, {
          name: editingConvTag.name,
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
          showNotification(t('tags.deleteSuccess'), '', 'success');
          await loadTags();
        } catch (err) {
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

    try {
      if (isCreatingConfigTag) {
        await api.createConfigTag({
          name: editingConfigTag.name,
          color: editingConfigTag.color || PRESET_COLORS[0].value,
        });
        showNotification(t('tags.createSuccess'), '', 'success');
      } else {
        await api.updateConfigTag(editingConfigTag.id!, {
          name: editingConfigTag.name,
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
          showNotification(t('tags.deleteSuccess'), '', 'success');
          await loadTags();
        } catch (err) {
          showNotification(t('tags.deleteSuccess'), (err as Error).message, 'error');
        }
      },
    });
  };

  // 渲染标签列表
  const renderTagList = (
    tags: ConversationTag[] | ConfigTag[],
    type: 'conversation' | 'config',
  ) => {
    const editingTag = type === 'conversation' ? editingConvTag : editingConfigTag;
    const isCreating = type === 'conversation' ? isCreatingConvTag : isCreatingConfigTag;
    const setEditingTag = type === 'conversation' ? setEditingConvTag : setEditingConfigTag;
    const handleSave = type === 'conversation' ? handleSaveConvTag : handleSaveConfigTag;
    const handleDelete = type === 'conversation' ? handleDeleteConvTag : handleDeleteConfigTag;
    const handleCreate = type === 'conversation' ? handleCreateConvTag : handleCreateConfigTag;
    const setIsCreating = type === 'conversation' ? setIsCreatingConvTag : setIsCreatingConfigTag;

    return (
      <div className="space-y-3">
        {/* 标签列表 */}
        <ScrollToTop className="max-h-64 overflow-y-auto scrollbar-thin">
          <div className="space-y-2">
            {tags.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--muted)]">
                {t('tags.noTags')}
              </div>
            ) : (
              tags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-warm-hover)] hover:bg-[var(--border)] transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
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

        {/* 新建按钮 */}
        <button
          onClick={handleCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-xl transition-all duration-200 font-medium"
        >
          <Plus size={14} />
          {t('tags.create')}
        </button>

        {/* 编辑/创建表单 */}
        {editingTag && (
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--fg)]">
                {isCreating ? t('tags.create') : t('tags.edit')}
              </span>
              <button
                onClick={() => {
                  setEditingTag(null);
                  setIsCreating(false);
                }}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
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
              className="w-full px-3 py-2 text-sm bg-[var(--surface-warm)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30"
            />

            <div>
              <label className="block text-xs text-[var(--muted)] mb-2">{t('tags.color')}</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setEditingTag({ ...editingTag, color: color.value })}
                    className={`w-7 h-7 rounded-full transition-all duration-200 ${
                      editingTag.color === color.value
                        ? 'ring-2 ring-offset-2 ring-[var(--accent-indigo)]'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] transition-all duration-200 font-medium"
            >
              <Check size={14} />
              {isCreating ? t('common.create') : t('common.save')}
            </button>
          </div>
        )}
      </div>
    );
  };

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
            {renderTagList(conversationTags, 'conversation')}
          </div>

          {/* 配置标签 */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)]" />
              {t('tags.configTags')}
              <span className="text-[var(--muted)] font-normal">({configTags.length})</span>
            </h3>
            {renderTagList(configTags, 'config')}
          </div>
        </div>
      </div>

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
