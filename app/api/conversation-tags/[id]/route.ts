import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';
import { validateTagName, validateTagColor } from '@/app/api/_lib/tag-validation';

/**
 * PUT /api/conversation-tags/:id
 * 更新对话标签
 * Body: { name?: string; color?: string }
 */
export const PUT = withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = await request.json();
  const { name, color } = body;

  if (name !== undefined) {
    const nameError = validateTagName(name);
    if (nameError) return nameError;
  }

  if (color !== undefined) {
    const colorError = validateTagColor(color);
    if (colorError) return colorError;
  }

  // 检查同名标签（排除自身）
  if (name !== undefined) {
    const existing = await tagManager.getConversationTags();
    if (existing.some(t => t.name === (name as string).trim() && t.id !== id)) {
      return NextResponse.json({ error: '同名标签已存在' }, { status: 409 });
    }
  }

  const tag = await tagManager.updateConversationTag(id, { name: name?.trim(), color });
  return NextResponse.json(tag);
}, '/api/conversation-tags/[id] PUT');

/**
 * DELETE /api/conversation-tags/:id
 * 删除对话标签
 */
export const DELETE = withErrorHandling(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  await tagManager.deleteConversationTag(id);
  return NextResponse.json({ success: true });
}, '/api/conversation-tags/[id] DELETE');
