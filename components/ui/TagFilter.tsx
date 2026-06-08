'use client';

import TagBadge from './TagBadge';
import { useLocale } from '@/lib/locales';
import type { ConversationTag, ConfigTag } from '@/lib/types';

interface TagFilterProps {
  tags: ConversationTag[] | ConfigTag[];
  selectedTagId: string | null;
  onChange: (tagId: string | null) => void;
}

/** 标签筛选器组件 */
export default function TagFilter({
  tags,
  selectedTagId,
  onChange,
}: TagFilterProps) {
  const { t } = useLocale();

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-1">
      <TagBadge
        name={t('tags.all')}
        color={selectedTagId === null ? '#6366f1' : '#94a3b8'}
        size="md"
        selected={selectedTagId === null}
        onClick={() => onChange(null)}
      />
      {tags.map(tag => (
        <TagBadge
          key={tag.id}
          name={tag.name}
          color={tag.color}
          size="md"
          selected={selectedTagId === tag.id}
          onClick={() => onChange(selectedTagId === tag.id ? null : tag.id)}
        />
      ))}
    </div>
  );
}
