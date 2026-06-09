'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Tag } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import type { ConversationTag, ConfigTag } from '@/lib/types';

interface TagFilterProps {
  tags: ConversationTag[] | ConfigTag[];
  selectedTagId: string | null;
  onChange: (tagId: string | null) => void;
}

/** 紧凑标签筛选器 — 图标按钮 + portal 下拉菜单（不受父容器 overflow/事件影响） */
export default function TagFilter({
  tags,
  selectedTagId,
  onChange,
}: TagFilterProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 计算菜单位置
  const updateMenuPos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  // 打开时计算位置 & 监听滚动/resize
  useEffect(() => {
    if (!isOpen) return;
    updateMenuPos();
    const handleUpdate = () => updateMenuPos();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, updateMenuPos]);

  // 点击外部关闭（检查按钮和菜单）
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (tags.length === 0) return null;

  const selectedTag = selectedTagId ? tags.find(t => t.id === selectedTagId) : null;

  const menuContent = isOpen && (
    <div
      ref={menuRef}
      className="fixed z-[200] w-48 bg-[var(--surface-warm)] backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgba(28,25,23,0.12)] overflow-hidden animate-slide-up"
      style={{ top: menuPos.top, right: menuPos.right }}
    >
      {/* 全部选项 */}
      <button
        onClick={() => { onChange(null); setIsOpen(false); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
          selectedTagId === null
            ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5'
            : 'text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--muted)]/30" />
        <span className="flex-1 text-left">{t('tags.all')}</span>
        {selectedTagId === null && <span className="text-[10px] text-[var(--accent-indigo)]">✓</span>}
      </button>

      {/* 分隔线 */}
      <div className="h-px bg-[var(--border)]" />

      {/* 标签列表 */}
      <div className="max-h-48 overflow-y-auto scrollbar-thin">
        {tags.map(tag => (
          <button
            key={tag.id}
            onClick={() => { onChange(selectedTagId === tag.id ? null : tag.id); setIsOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
              selectedTagId === tag.id
                ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5'
                : 'text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="flex-1 text-left truncate">{tag.name}</span>
            {selectedTagId === tag.id && <span className="text-[10px] text-[var(--accent-indigo)]">✓</span>}
          </button>
        ))}
      </div>

    </div>
  );

  return (
    <>
      {/* 触发按钮 */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
          }
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 ${
          selectedTagId
            ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
            : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
        }`}
      >
        <Tag size={14} />
        {selectedTag && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-[var(--surface-warm)]"
            style={{ backgroundColor: selectedTag.color }}
          />
        )}
      </button>

      {/* 下拉菜单 — portal 到 body */}
      {createPortal(menuContent, document.body)}
    </>
  );
}
