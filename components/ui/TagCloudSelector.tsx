'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import TagBadge from './TagBadge';
import { useLocale } from '@/lib/locales';
import type { ConversationTag, ConfigTag } from '@/lib/types';

interface TagCloudSelectorProps {
  tags: ConversationTag[] | ConfigTag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onClose: () => void;
  maxTags?: number;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/** 标签云选择器组件（portal 渲染，不受父容器裁剪） */
export default function TagCloudSelector({
  tags,
  selectedTagIds,
  onChange,
  onClose,
  maxTags = 10,
  triggerRef,
}: TagCloudSelectorProps) {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 计算菜单位置
  const updateMenuPos = useCallback(() => {
    const el = triggerRef?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // 优先向下展开，空间不足时向上
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 320; // 预估菜单高度
    const top = spaceBelow > menuHeight + 8
      ? rect.bottom + 4
      : rect.top - menuHeight - 4;
    setMenuPos({
      top,
      left: Math.min(rect.left, window.innerWidth - 272), // 272 = w-64 + padding
    });
  }, [triggerRef]);

  // 初始化位置 & 监听滚动/resize
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始化菜单位置
    updateMenuPos();
    const handleUpdate = () => updateMenuPos();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [updateMenuPos]);

  // 自动聚焦搜索框
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, triggerRef]);

  // 过滤标签
  const filteredTags = searchQuery
    ? tags.filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tags;

  // 切换标签选择
  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else if (selectedTagIds.length < maxTags) {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-[200] w-64 bg-[var(--surface-warm)] backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-[0_10px_40px_rgba(28,25,23,0.10)] overflow-hidden animate-slide-up"
      style={{ top: menuPos.top, left: menuPos.left }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <span className="text-sm font-medium text-[var(--fg)]">{t('tags.selectTags')}</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
        >
          <X size={14} />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2 border-b border-black/5">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-[var(--muted)]/50" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={t('tags.name') + '...'}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--surface-warm-hover)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/20"
          />
        </div>
      </div>

      {/* 标签云 */}
      <div className="p-3 max-h-48 overflow-y-auto scrollbar-thin">
        {filteredTags.length === 0 ? (
          <div className="text-center py-4 text-sm text-[var(--muted)]">
            {searchQuery ? t('conversation.noResults') : t('tags.noTags')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredTags.map(tag => (
              <TagBadge
                key={tag.id}
                name={tag.name}
                color={tag.color}
                size="md"
                selected={selectedTagIds.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      {selectedTagIds.length > 0 && (
        <div className="px-4 py-2 border-t border-black/5 text-[11px] text-[var(--muted)]">
          {selectedTagIds.length}/{maxTags} {t('tags.selectTags')}
        </div>
      )}
    </div>
  );

  return createPortal(menuContent, document.body);
}
