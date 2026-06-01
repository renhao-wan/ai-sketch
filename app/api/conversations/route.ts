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
 * Clear all conversations or delete specific conversations by IDs
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = body.ids as string[] | undefined;

    if (ids && ids.length > 0) {
      await conversationManager.deleteMany(ids);
    } else {
      await conversationManager.clearAll();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversations:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
