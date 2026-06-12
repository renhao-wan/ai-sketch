import { NextResponse } from 'next/server';
import { conversationManager } from '@/lib/db/conversation-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/** 排序字段白名单 */
const VALID_SORT_FIELDS = ['updated_at', 'created_at'];
/** 排序方向白名单 */
const VALID_ORDERS = ['asc', 'desc'];

/**
 * GET /api/conversations
 * List conversations with search, pagination and sorting
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('search') || undefined;

  // 排序字段白名单校验（防 SQL 注入）
  const rawSort = searchParams.get('sort') || 'updated_at';
  const sort = VALID_SORT_FIELDS.includes(rawSort) ? rawSort : 'updated_at';

  // 排序方向白名单校验
  const rawOrder = searchParams.get('order') || 'desc';
  const order = VALID_ORDERS.includes(rawOrder) ? rawOrder : 'desc';

  // 分页参数范围限制
  const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);

  const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
  const offset = isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

  const tagId = searchParams.get('tagId') || undefined;

  const result = await conversationManager.search({
    query,
    sort,
    order,
    limit,
    offset,
    tagId,
  });

  const hasMore = offset + limit < result.total;

  return NextResponse.json({
    conversations: result.conversations,
    total: result.total,
    hasMore,
  });
}, '/api/conversations GET');

/**
 * DELETE /api/conversations
 * Clear all conversations or delete specific conversations by IDs
 */
export const DELETE = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const ids = body.ids as string[] | undefined;

  if (ids && ids.length > 0) {
    await conversationManager.deleteMany(ids);
  } else {
    await conversationManager.clearAll();
  }

  return NextResponse.json({ success: true });
}, '/api/conversations DELETE');
