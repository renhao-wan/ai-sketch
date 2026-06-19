import { NextResponse } from 'next/server';
import { customActionManager } from '@/lib/db/custom-action-manager';

export async function GET() {
  try {
    const actions = await customActionManager.getCanvasActions();

    // 获取自定义操作的详细信息
    const customActions = await customActionManager.getAll();
    const customActionMap = new Map(customActions.map(a => [a.id, a]));

    // 构建完整的操作列表
    const result = actions.map(action => ({
      ...action,
      details: action.action_type === 'custom'
        ? customActionMap.get(action.action_id)
        : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching canvas actions:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { actions } = body;

    if (!Array.isArray(actions)) {
      return NextResponse.json({ error: '参数错误: actions 应为数组' }, { status: 400 });
    }

    // 验证最多 4 个操作
    if (actions.length > 4) {
      return NextResponse.json({ error: '最多只能显示 4 个操作' }, { status: 400 });
    }

    await customActionManager.updateCanvasActions(actions);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating canvas actions:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}