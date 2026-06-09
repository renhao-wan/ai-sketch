'use client';

import { useState, useRef, useEffect } from 'react';
import { Tag, X } from 'lucide-react';
import type { ConversationTag, ConfigTag } from '@/lib/types';

interface TagFilterProps {
  tags: ConversationTag[] | ConfigTag[];
  selectedTagId: string | null;
  onChange: (tagId: string | null) => void;
}

/** 紧凑标签筛选器 — 图标按钮 + 下拉菜单 */
export default function TagFilter({
  tags,
  selectedTagId,
  onChange,
}: TagFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (tags.length === 0) return null;

  const selectedTag = selectedTagId ? tags.find(t => t.id === selectedTagId) : null;

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 ${
          selectedTagId
            ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
            : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
        }`}
      >
        <Tag size={14} />
        {/* 选中指示器 */}
        {selectedTag && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-[var(--surface-warm)]"
            style={{ backgroundColor: selectedTag.color }}
          />
        )}
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 w-48 bg-[var(--surface-warm)] backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgba(28,25,23,0.12)] overflow-hidden animate-slide-up">
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
            <span className="flex-1 text-left">全部</span>
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

          {/* 清除筛选 */}
          {selectedTagId && (
            <>
              <div className="h-px bg-[var(--border)]" />
              <button
                onClick={() => { onChange(null); setIsOpen(false); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
              >
                <X size={12} />
                清除筛选
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
