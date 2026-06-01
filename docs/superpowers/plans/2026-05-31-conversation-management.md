# 会话管理优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化会话管理功能，添加搜索、无限滚动分页、排序和数量限制

**Architecture:** 修改后端 ConversationManager 添加搜索/分页/排序支持，修改 API 路由支持查询参数，修改前端 ConversationList 组件添加搜索框、排序切换和无限滚动

**Tech Stack:** Next.js, React, TypeScript, SQLite (sql.js), lucide-react

---

## 文件结构

- `lib/db/conversation-manager.ts` - 添加 search() 和 getCount() 方法
- `app/api/conversations/route.ts` - 修改 GET 处理函数，支持查询参数
- `app/api/conversations/count/route.ts` - 新建文件，实现数量检查 API
- `lib/api-client.ts` - 修改 fetchConversations() 和添加 fetchConversationCount()
- `components/ai/ConversationList.tsx` - 添加搜索、排序、无限滚动、数量限制
- `locales/zh.ts` - 添加中文翻译
- `locales/en.ts` - 添加英文翻译

---

### Task 1: 添加国际化翻译

**Files:**
- Modify: `locales/zh.ts`
- Modify: `locales/en.ts`

- [ ] **Step 1: 添加中文翻译**

在 `locales/zh.ts` 的 `conversation` 对象中添加以下翻译：

```typescript
conversation: {
  // ... 现有翻译
  search: '搜索会话',
  sortBy: '排序方式',
  recentlyUpdated: '最近更新',
  oldestUpdated: '最早更新',
  recentlyCreated: '最新创建',
  oldestCreated: '最早创建',
  loadMore: '加载更多...',
  loading: '加载中...',
  limitReached: '会话数量已达上限',
  limitReachedMsg: '您已有 {limit} 个会话，达到上限。请删除一些旧会话后再创建新会话。',
  noResults: '未找到匹配的会话',
}
```

- [ ] **Step 2: 添加英文翻译**

在 `locales/en.ts` 的 `conversation` 对象中添加以下翻译：

```typescript
conversation: {
  // ... 现有翻译
  search: 'Search conversations',
  sortBy: 'Sort by',
  recentlyUpdated: 'Recently updated',
  oldestUpdated: 'Oldest updated',
  recentlyCreated: 'Recently created',
  oldestCreated: 'Oldest created',
  loadMore: 'Load more...',
  loading: 'Loading...',
  limitReached: 'Conversation limit reached',
  limitReachedMsg: 'You have {limit} conversations, which is the limit. Please delete some old conversations before creating new ones.',
  noResults: 'No matching conversations found',
}
```

- [ ] **Step 3: Commit**

```bash
git add locales/zh.ts locales/en.ts
git commit -m "feat: 添加会话管理国际化翻译"
```

---

### Task 2: 后端 ConversationManager 添加搜索/分页/排序方法

**Files:**
- Modify: `lib/db/conversation-manager.ts`

- [ ] **Step 1: 添加 search 方法**

在 `ConversationManager` 类中添加以下方法：

```typescript
async search(params: {
  query?: string;
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  conversations: Conversation[];
  total: number;
}> {
  const db = await getDb();
  const { query, sort = 'updated_at', order = 'desc', limit = 20, offset = 0 } = params;

  // 构建 WHERE 子句
  const whereClauses: string[] = [];
  const queryParams: unknown[] = [];

  if (query && query.trim()) {
    whereClauses.push('LOWER(title) LIKE ?');
    queryParams.push(`%${query.toLowerCase()}%`);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 验证排序字段
  const validSortFields = ['updated_at', 'created_at'];
  const validOrders = ['asc', 'desc'];
  const sortField = validSortFields.includes(sort) ? sort : 'updated_at';
  const sortOrder = validOrders.includes(order) ? order : 'desc';

  // 获取总数
  const countSql = `SELECT COUNT(*) as total FROM conversations ${whereStr}`;
  const countResult = db.exec(countSql, queryParams);
  const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0;

  // 获取分页数据
  const dataSql = `SELECT * FROM conversations ${whereStr} ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
  const dataParams = [...queryParams, limit, offset];
  const result = db.exec(dataSql, dataParams);

  const conversations = result.length > 0
    ? result[0].values.map((row: unknown[]) => parseConversationRow(row))
    : [];

  return { conversations, total };
}
```

- [ ] **Step 2: 添加 getCount 方法**

在 `ConversationManager` 类中添加以下方法：

```typescript
async getCount(): Promise<number> {
  const db = await getDb();
  const result = db.exec('SELECT COUNT(*) as count FROM conversations');
  return result.length > 0 ? (result[0].values[0][0] as number) : 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/conversation-manager.ts
git commit -m "feat: 添加会话搜索/分页/排序方法"
```

---

### Task 3: 后端 API 路由修改

**Files:**
- Modify: `app/api/conversations/route.ts`
- Create: `app/api/conversations/count/route.ts`

- [ ] **Step 1: 修改 GET /api/conversations**

修改 `app/api/conversations/route.ts` 的 GET 处理函数：

```typescript
import { NextResponse } from 'next/server';
import { conversationManager } from '@/lib/db/conversation-manager';

/**
 * GET /api/conversations
 * List conversations with search, pagination and sorting
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('search') || undefined;
    const sort = searchParams.get('sort') || 'updated_at';
    const order = searchParams.get('order') || 'desc';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const result = await conversationManager.search({
      query,
      sort,
      order,
      limit,
      offset,
    });

    const hasMore = offset + limit < result.total;

    return NextResponse.json({
      conversations: result.conversations,
      total: result.total,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/conversations
 * Clear all conversations and their messages
 */
export async function DELETE() {
  try {
    await conversationManager.clearAll();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing conversations:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建 GET /api/conversations/count**

创建新文件 `app/api/conversations/count/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { conversationManager } from '@/lib/db/conversation-manager';

/**
 * GET /api/conversations/count
 * Get conversation count and limit
 */
export async function GET() {
  try {
    const count = await conversationManager.getCount();
    const limit = 50; // 会话数量上限
    return NextResponse.json({ count, limit });
  } catch (error) {
    console.error('Error fetching conversation count:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/conversations/route.ts app/api/conversations/count/route.ts
git commit -m "feat: 添加会话搜索/分页/排序 API"
```

---

### Task 4: 前端 API 客户端修改

**Files:**
- Modify: `lib/api-client.ts`

- [ ] **Step 1: 修改 fetchConversations 函数**

修改 `fetchConversations` 函数：

```typescript
export async function fetchConversations(params?: {
  search?: string;
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  conversations: Conversation[];
  total: number;
  hasMore: boolean;
}> {
  const searchParams = new URLSearchParams();

  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  const url = `/api/conversations${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return request(url);
}
```

- [ ] **Step 2: 添加 fetchConversationCount 函数**

添加新函数：

```typescript
export async function fetchConversationCount(): Promise<{
  count: number;
  limit: number;
}> {
  return request('/api/conversations/count');
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/api-client.ts
git commit -m "feat: 更新会话 API 客户端支持搜索/分页"
```

---

### Task 5: 前端 ConversationList 组件添加搜索和排序

**Files:**
- Modify: `components/ai/ConversationList.tsx`

- [ ] **Step 1: 添加状态声明**

在 `ConversationList` 组件中添加以下状态：

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
const [page, setPage] = useState(0);
const [hasMore, setHasMore] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [totalCount, setTotalCount] = useState(0);
```

- [ ] **Step 2: 修改 loadConversations 函数**

修改 `loadConversations` 函数以支持搜索、分页和排序：

```typescript
const loadConversations = async (reset = false, pageNum = 0) => {
  try {
    const offset = pageNum * 20;
    const result = await api.fetchConversations({
      search: searchQuery || undefined,
      sort: sortBy,
      order: sortOrder,
      limit: 20,
      offset,
    });

    if (reset) {
      setConversations(result.conversations);
    } else {
      setConversations(prev => [...prev, ...result.conversations]);
    }

    setTotalCount(result.total);
    setHasMore(result.hasMore);
  } catch (err) {
    console.error('加载会话失败:', err);
  }
};
```

- [ ] **Step 3: 添加防抖搜索效果**

添加防抖搜索的 useEffect：

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setPage(0);
    loadConversations(true, 0);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery, sortBy, sortOrder]);
```

- [ ] **Step 4: 添加滚动加载函数**

添加无限滚动的处理函数：

```typescript
const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
  const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
  if (scrollHeight - scrollTop - clientHeight < 50 && hasMore && !isLoadingMore) {
    loadMore();
  }
}, [hasMore, isLoadingMore]);

const loadMore = async () => {
  if (isLoadingMore) return;
  setIsLoadingMore(true);
  const nextPage = page + 1;
  await loadConversations(false, nextPage);
  setPage(nextPage);
  setIsLoadingMore(false);
};
```

- [ ] **Step 5: Commit**

```bash
git add components/ai/ConversationList.tsx
git commit -m "feat: 添加会话搜索和排序功能"
```

---

### Task 6: 前端 ConversationList 组件添加 UI

**Files:**
- Modify: `components/ai/ConversationList.tsx`

- [ ] **Step 1: 添加搜索框和排序切换 UI**

在会话列表顶部添加搜索框和排序切换：

```tsx
<div className="px-4 py-2 space-y-2">
  {/* 搜索框 */}
  <div className="relative">
    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]/50" />
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder={t('conversation.search')}
      className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200"
    />
  </div>

  {/* 排序切换 */}
  <div className="flex items-center justify-between">
    <span className="text-xs text-[var(--muted)]">
      {t('conversation.sortBy')}:
    </span>
    <Dropdown
      options={[
        { value: 'updated_at-desc', label: t('conversation.recentlyUpdated') },
        { value: 'updated_at-asc', label: t('conversation.oldestUpdated') },
        { value: 'created_at-desc', label: t('conversation.recentlyCreated') },
        { value: 'created_at-asc', label: t('conversation.oldestCreated') },
      ]}
      value={`${sortBy}-${sortOrder}`}
      onChange={(v) => {
        const [sort, order] = v.split('-');
        setSortBy(sort as 'updated_at' | 'created_at');
        setSortOrder(order as 'asc' | 'desc');
      }}
    />
  </div>
</div>
```

- [ ] **Step 2: 添加加载更多按钮和状态**

在会话列表底部添加加载更多按钮：

```tsx
{hasMore && (
  <div className="px-4 py-2">
    <button
      onClick={loadMore}
      disabled={isLoadingMore}
      className="w-full py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-xl transition-all duration-200 disabled:opacity-50"
    >
      {isLoadingMore ? t('conversation.loading') : t('conversation.loadMore')}
    </button>
  </div>
)}
```

- [ ] **Step 3: 添加空搜索结果提示**

当搜索无结果时显示提示：

```tsx
{conversations.length === 0 && !isLoading && (
  <div className="px-4 py-8 text-center">
    <p className="text-sm text-[var(--muted)]">
      {searchQuery ? t('conversation.noResults') : t('conversation.noConversations')}
    </p>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add components/ai/ConversationList.tsx
git commit -m "feat: 添加会话搜索和排序 UI"
```

---

### Task 7: 前端添加无限滚动和数量限制

**Files:**
- Modify: `components/ai/ConversationList.tsx`

- [ ] **Step 1: 添加滚动事件监听**

修改列表容器，添加滚动事件监听：

```tsx
<div
  className="flex-1 overflow-y-auto scrollbar-thin"
  onScroll={handleScroll}
>
  {/* 会话列表内容 */}
</div>
```

- [ ] **Step 2: 添加数量限制检查函数**

添加创建会话前的数量限制检查：

```typescript
const handleCreateConversation = async () => {
  try {
    const { count, limit } = await api.fetchConversationCount();
    if (count >= limit) {
      setConfirmDialog({
        isOpen: true,
        title: t('conversation.limitReached'),
        message: t('conversation.limitReachedMsg').replace('{limit}', String(limit)),
        onConfirm: null,
      });
      return;
    }
    // 正常创建会话逻辑
    onCreateNew?.();
  } catch (err) {
    console.error('检查会话数量失败:', err);
  }
};
```

- [ ] **Step 3: 修改创建会话按钮**

修改创建新会话的按钮，使用新的检查函数：

```tsx
<button
  onClick={handleCreateConversation}
  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/90 transition-all duration-200"
>
  <Plus size={12} />
  <span>{t('conversation.new')}</span>
</button>
```

- [ ] **Step 4: Commit**

```bash
git add components/ai/ConversationList.tsx
git commit -m "feat: 添加无限滚动和数量限制检查"
```

---

### Task 8: 测试功能

**Files:**
- None (手动测试)

- [ ] **Step 1: 测试搜索功能**

1. 打开会话列表
2. 输入关键词搜索
3. 验证搜索结果正确
4. 清空搜索框，验证列表恢复

- [ ] **Step 2: 测试排序功能**

1. 切换排序方式
2. 验证列表重新排序
3. 验证升序/降序切换正确

- [ ] **Step 3: 测试无限滚动**

1. 创建超过 20 个会话
2. 滚动到底部
3. 验证自动加载更多
4. 验证加载状态显示

- [ ] **Step 4: 测试数量限制**

1. 创建 50 个会话
2. 尝试创建第 51 个
3. 验证显示限制提示
4. 删除一个会话后，验证可以正常创建

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: 完成会话管理优化功能"
```

---

## 自审清单

- [x] **规格覆盖**: 所有设计文档中的需求都有对应的实现步骤
- [x] **Placeholder 扫描**: 没有 TBD、TODO 或模糊描述
- [x] **类型一致性**: 状态变量名、函数名、翻译键名保持一致
- [x] **边界情况**: 覆盖了搜索、排序、分页的边界情况
- [x] **国际化**: 中英文翻译都已添加
