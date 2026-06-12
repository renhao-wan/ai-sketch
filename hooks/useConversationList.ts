'use client';

/**
 * useConversationList — 共享的会话列表逻辑 Hook
 *
 * 封装 HistoryModal 和 ConversationList 共有的：
 * - 会话搜索、分页加载
 * - 标签加载和批量关联查询
 * - 防抖搜索
 * - 无限滚动加载更多
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/lib/api/client';
import type { Conversation, ConversationTag } from '@/lib/types';

const PAGE_SIZE = 20;

interface UseConversationListOptions {
  /** 是否激活（弹窗打开 / 下拉展开时为 true） */
  isActive: boolean;
  /** 排序字段（仅 HistoryModal 使用，默认 'updated_at'） */
  sortBy?: 'updated_at' | 'created_at';
  /** 排序方向（仅 HistoryModal 使用，默认 'desc'） */
  sortOrder?: 'asc' | 'desc';
}

interface UseConversationListReturn {
  /** 会话列表 */
  conversations: Conversation[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否还有更多 */
  hasMore: boolean;
  /** 总数 */
  totalCount: number;
  /** 搜索关键词 */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  /** 标签列表 */
  tags: ConversationTag[];
  /** 会话标签映射 */
  conversationTagsMap: Record<string, ConversationTag[]>;
  /** 选中的标签 ID */
  selectedTagId: string | null;
  setSelectedTagId: (id: string | null) => void;
  /** 加载更多（供无限滚动调用） */
  loadMore: () => void;
}

export function useConversationList(options: UseConversationListOptions): UseConversationListReturn {
  const { isActive, sortBy = 'updated_at', sortOrder = 'desc' } = options;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [tags, setTags] = useState<ConversationTag[]>([]);
  const [conversationTagsMap, setConversationTagsMap] = useState<Record<string, ConversationTag[]>>({});
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const offsetRef = useRef(0);

  /** 加载会话（首次 or 加载更多） */
  const loadConversations = useCallback(async (reset: boolean) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const offset = reset ? 0 : offsetRef.current;
      const result = await api.fetchConversations({
        limit: PAGE_SIZE,
        offset,
        search: searchQuery || undefined,
        sort: sortBy,
        order: sortOrder,
        tagId: selectedTagId || undefined,
      });
      setConversations(prev => reset ? result.conversations : [...prev, ...result.conversations]);
      setHasMore(result.hasMore);
      setTotalCount(result.total);
      offsetRef.current = offset + result.conversations.length;
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, searchQuery, selectedTagId, sortBy, sortOrder]);

  /** 激活时重置状态 */
  useEffect(() => {
    if (isActive) {
      offsetRef.current = 0;
      setHasMore(true);
      setSearchQuery('');
      setSelectedTagId(null);
    }
  }, [isActive]);

  /** 搜索防抖（含标签筛选变化） */
  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      offsetRef.current = 0;
      setHasMore(true);
      loadConversations(true);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConversations 不应在依赖中
  }, [isActive, searchQuery, selectedTagId, sortBy, sortOrder]);

  /** 加载所有标签 */
  useEffect(() => {
    const loadTags = async () => {
      try {
        const convTags = await api.fetchConversationTags();
        setTags(convTags);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    };
    loadTags();
  }, []);

  /** 批量加载当前可见对话的标签 */
  useEffect(() => {
    if (!isActive || conversations.length === 0) return;
    const ids = conversations.map(c => c.id);
    api.fetchConversationTagsBatch(ids).then(setConversationTagsMap).catch(() => {});
  }, [isActive, conversations]);

  /** 加载更多 */
  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    loadConversations(false);
  }, [isLoading, hasMore, loadConversations]);

  return {
    conversations,
    isLoading,
    hasMore,
    totalCount,
    searchQuery,
    setSearchQuery,
    tags,
    conversationTagsMap,
    selectedTagId,
    setSelectedTagId,
    loadMore,
  };
}
