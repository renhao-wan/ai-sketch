import { NextResponse } from 'next/server';
import { historyManager } from '@/lib/history-manager';

/**
 * GET /api/history
 * List all history items. Optional: ?limit=N
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    let histories = await historyManager.getHistories();
    if (limitParam) {
      histories = histories.slice(0, parseInt(limitParam, 10));
    }
    return NextResponse.json({ histories });
  } catch (error) {
    console.error('Error fetching histories:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/history
 * Create a new history entry
 * Body: { chartType, userInput, generatedCode, config: { name, model } }
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { chartType, userInput, generatedCode, config } = data as {
      chartType: string;
      userInput: string;
      generatedCode: string;
      config: { name?: string; model?: string };
    };

    if (!chartType || !userInput || !generatedCode) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const history = await historyManager.addHistory({
      chartType,
      userInput,
      generatedCode,
      config: config || {},
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error creating history:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/history
 * Clear all history
 */
export async function DELETE() {
  try {
    await historyManager.clearAll();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing history:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
