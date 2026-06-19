import { NextResponse } from 'next/server';
import { customActionManager } from '@/lib/db/custom-action-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/**
 * GET /api/custom-actions/[id]
 * 获取单个自定义操作
 */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const action = await customActionManager.getById(id);
  if (!action) {
    return NextResponse.json({ error: '操作不存在' }, { status: 404 });
  }
  return NextResponse.json(action);
}, '/api/custom-actions/[id] GET');

/**
 * PUT /api/custom-actions/[id]
 * 更新自定义操作
 */
export const PUT = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();

  // 输入验证
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: '操作名称不能为空' }, { status: 400 });
    }
    if (body.name.length > 50) {
      return NextResponse.json({ error: '操作名称不能超过 50 个字符' }, { status: 400 });
    }
  }

  if (body.prompt !== undefined) {
    if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return NextResponse.json({ error: '提示词不能为空' }, { status: 400 });
    }
    if (body.prompt.length > 2000) {
      return NextResponse.json({ error: '提示词不能超过 2000 个字符' }, { status: 400 });
    }
  }

  if (body.action_type !== undefined && !['modify', 'explain'].includes(body.action_type)) {
    return NextResponse.json({ error: '无效的操作类型，必须是 modify 或 explain' }, { status: 400 });
  }

  const action = await customActionManager.update(id, body);
  if (!action) {
    return NextResponse.json({ error: '操作不存在' }, { status: 404 });
  }
  return NextResponse.json(action);
}, '/api/custom-actions/[id] PUT');

/**
 * DELETE /api/custom-actions/[id]
 * 删除自定义操作
 */
export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await customActionManager.delete(id);
  return NextResponse.json({ success: true });
}, '/api/custom-actions/[id] DELETE');
