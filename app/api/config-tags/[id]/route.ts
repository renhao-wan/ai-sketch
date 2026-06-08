import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/**
 * PUT /api/config-tags/:id
 * 更新配置标签
 * Body: { name?: string; color?: string }
 */
export const PUT = withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = await request.json();
  const { name, color } = body;

  if (name !== undefined && name.length > 20) {
    return NextResponse.json({ error: '标签名称不能超过 20 个字符' }, { status: 400 });
  }

  const tag = await tagManager.updateConfigTag(id, { name, color });
  return NextResponse.json(tag);
}, '/api/config-tags/[id] PUT');

/**
 * DELETE /api/config-tags/:id
 * 删除配置标签
 */
export const DELETE = withErrorHandling(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  await tagManager.deleteConfigTag(id);
  return NextResponse.json({ success: true });
}, '/api/config-tags/[id] DELETE');
