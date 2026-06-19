import { NextResponse } from 'next/server';
import { customActionManager } from '@/lib/db/custom-action-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/**
 * GET /api/custom-actions
 * 获取所有自定义操作
 */
export const GET = withErrorHandling(async () => {
  const actions = await customActionManager.getAll();
  return NextResponse.json(actions);
}, '/api/custom-actions GET');

/**
 * POST /api/custom-actions
 * 创建新的自定义操作
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { name, prompt, icon, action_type } = body;

  if (!name || !prompt) {
    return NextResponse.json({ error: '缺少必要参数: name, prompt' }, { status: 400 });
  }

  const action = await customActionManager.create({
    name,
    prompt,
    icon: icon || 'Zap',
    action_type: action_type || 'modify',
    enabled: 1,
    sort_order: 0,
  });

  return NextResponse.json(action);
}, '/api/custom-actions POST');

/**
 * DELETE /api/custom-actions
 * 删除所有自定义操作
 */
export const DELETE = withErrorHandling(async () => {
  const actions = await customActionManager.getAll();
  for (const action of actions) {
    await customActionManager.delete(action.id);
  }
  return NextResponse.json({ success: true, deleted: actions.length });
}, '/api/custom-actions DELETE');
