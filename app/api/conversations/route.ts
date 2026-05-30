import { NextResponse } from 'next/server';
import { conversationManager } from '@/lib/db/conversation-manager';

/**
 * GET /api/conversations
 * List all conversations (without messages). Optional: ?limit=N
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const conversations = await conversationManager.getAll(limit);
    return NextResponse.json({ conversations });
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
