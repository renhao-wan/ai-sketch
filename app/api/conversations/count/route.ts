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
