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
