import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';
import { validateTagIds } from '@/app/api/_lib/tag-validation';

/**
 * PUT /api/conversations/:id/tags
 * 设置对话标签（替换）
 * Body: { tagIds: string[] }
 */
export const PUT = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await request.json();
    const { tagIds } = body;

    const error = validateTagIds(tagIds);
    if (error) return error;

    await tagManager.setConversationTags(id, tagIds);
    const tags = await tagManager.getConversationTagsByIds(id);
    return NextResponse.json({ tags });
  },
  '/api/conversations/[id]/tags PUT',
);

/**
 * GET /api/conversations/:id/tags
 * 获取对话标签
 */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const tags = await tagManager.getConversationTagsByIds(id);
    return NextResponse.json({ tags });
  },
  '/api/conversations/[id]/tags GET',
);
