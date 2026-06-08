import { NextResponse } from 'next/server';
import { conversationManager } from '@/lib/db/conversation-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/**
 * GET /api/conversations
 * List conversations with search, pagination and sorting
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('search') || undefined;
  const sort = searchParams.get('sort') || 'updated_at';
  const order = searchParams.get('order') || 'desc';
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;
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
