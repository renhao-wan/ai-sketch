import { NextResponse } from 'next/server';
import { historyManager } from '@/lib/history-manager';

/**
 * DELETE /api/history/[id]
 * Delete a single history entry
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await historyManager.deleteHistory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting history:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
