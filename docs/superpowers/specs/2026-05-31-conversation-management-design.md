# 会话管理优化设计文档

## 背景

当前会话管理存在以下问题：
1. 可以无限制添加会话，缺乏数量控制
2. 没有搜索功能，难以找到特定会话
3. 没有分页功能，所有会话一次性加载
4. 排序方式固定，无法按创建时间排序

需要优化会话管理功能，提升用户体验。

## 目标

1. 限制会话最大数量为 50 个，超出时提示用户删除旧会话
2. 添加标题搜索功能，支持防抖搜索
3. 实现无限滚动分页，提升加载性能
4. 支持多种排序方式（最后更新时间、创建时间）

## 功能需求

### 数量限制
- 最大会话数量：50 个
- 创建新会话前检查数量
- 超出限制时显示确认对话框，提示用户删除旧会话

### 搜索功能
- 搜索范围：只搜索会话标题
- 搜索方式：防抖搜索（输入停止 300ms 后触发）
- 搜索结果：实时更新列表

### 分页方式
- 类型：无限滚动
- 每页数量：20 条
- 加载方式：滚动到底部自动加载更多
- 加载状态：显示加载指示器

### 排序功能
- 支持字段：最后更新时间、创建时间
- 排序方向：升序、降序
- 默认排序：最后更新时间倒序
- 切换方式：下拉菜单选择

## 技术方案

### 后端 API 设计

#### 修改 GET /api/conversations

**请求参数：**
```
?search=keyword&sort=updated_at&order=desc&limit=20&offset=0
```

- `search` (string, optional) - 搜索关键词，搜索标题
- `sort` (string, optional) - 排序字段：`updated_at` | `created_at`，默认 `updated_at`
- `order` (string, optional) - 排序方向：`asc` | `desc`，默认 `desc`
- `limit` (number, optional) - 每页数量，默认 20
- `offset` (number, optional) - 偏移量，默认 0

**响应：**
```typescript
{
  conversations: Conversation[],
  total: number,
  hasMore: boolean
}
```

#### 新增 GET /api/conversations/count

**响应：**
```typescript
{
  count: number,
  limit: number
}
```

### 后端 ConversationManager 改动

#### 添加 search 方法

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
}>
```

**实现逻辑：**
1. 构建 SQL 查询，支持标题 LIKE 搜索
2. 支持排序和分页
3. 返回会话列表和总数

#### 添加 getCount 方法

```typescript
async getCount(): Promise<number>
```

### 前端 API 客户端改动

#### 修改 fetchConversations 函数

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
}>
```

#### 添加 fetchConversationCount 函数

```typescript
export async function fetchConversationCount(): Promise<{
  count: number;
  limit: number;
}>
```

### 前端 UI 改动

#### ConversationList.tsx 布局

```
┌─────────────────────────────────────────┐
│ [搜索框]                    [排序切换▼] │
├─────────────────────────────────────────┤
│ 会话 1                                  │
│ 会话 2                                  │
│ 会话 3                                  │
│ ...                                     │
│ [加载更多...]                           │
├─────────────────────────────────────────┤
│ [清空所有]                              │
└─────────────────────────────────────────┘
```

#### 新增状态

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
const [page, setPage] = useState(0);
const [hasMore, setHasMore] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [totalCount, setTotalCount] = useState(0);
```

#### 搜索功能实现

```typescript
// 防抖搜索
useEffect(() => {
  const timer = setTimeout(() => {
    setPage(0);
    loadConversations(true);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery, sortBy, sortOrder]);
```

#### 无限滚动实现

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

#### 排序切换 UI

```tsx
<Dropdown
  options={[
    { value: 'updated_at-desc', label: '最近更新' },
    { value: 'updated_at-asc', label: '最早更新' },
    { value: 'created_at-desc', label: '最新创建' },
    { value: 'created_at-asc', label: '最早创建' },
  ]}
  value={`${sortBy}-${sortOrder}`}
  onChange={(v) => {
    const [sort, order] = v.split('-');
    setSortBy(sort as 'updated_at' | 'created_at');
    setSortOrder(order as 'asc' | 'desc');
  }}
/>
```

#### 数量限制检查

```typescript
const handleCreateConversation = async () => {
  const { count, limit } = await api.fetchConversationCount();
  if (count >= limit) {
    setConfirmDialog({
      isOpen: true,
      title: t('conversation.limitReached'),
      message: t('conversation.limitReachedMsg').replace('{limit}', String(limit)),
      onConfirm: null, // 只有确认按钮，跳转到会话列表
    });
    return;
  }
  // 正常创建会话逻辑
};
```

## 实现细节

### 文件修改清单

1. **lib/db/conversation-manager.ts**
   - 添加 `search()` 方法
   - 添加 `getCount()` 方法

2. **app/api/conversations/route.ts**
   - 修改 `GET` 处理函数，支持查询参数

3. **app/api/conversations/count/route.ts**
   - 新建文件，实现数量检查 API

4. **lib/api-client.ts**
   - 修改 `fetchConversations()` 函数
   - 添加 `fetchConversationCount()` 函数

5. **components/ai/ConversationList.tsx**
   - 添加搜索框
   - 添加排序切换
   - 实现无限滚动
   - 添加数量限制检查

6. **locales/zh.ts 和 locales/en.ts**
   - 添加相关翻译

### 国际化翻译

```typescript
conversation: {
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

## 测试计划

### 功能测试

1. **搜索功能**
   - 输入关键词，验证搜索结果正确
   - 清空搜索框，验证列表恢复
   - 搜索无结果时显示提示

2. **分页功能**
   - 滚动到底部，验证自动加载更多
   - 验证加载状态显示
   - 验证没有更多时停止加载

3. **排序功能**
   - 切换排序方式，验证列表重新排序
   - 验证升序/降序切换正确

4. **数量限制**
   - 会话数量 < 50 时，正常创建
   - 会话数量 ≥ 50 时，显示提示对话框
   - 删除会话后，可以正常创建

### 边界情况

1. 搜索特殊字符
2. 快速连续搜索（防抖验证）
3. 网络错误处理
4. 空列表显示

## 设计决策

### 为什么只搜索标题？
- 标题是最主要的标识
- 搜索内容会增加复杂度
- 用户通常通过标题识别会话

### 为什么使用无限滚动？
- 比传统分页更流畅
- 用户体验更好
- 适合移动端

### 为什么限制 50 个？
- 平衡存储和性能
- 提示用户清理旧会话
- 避免列表过长影响查找
