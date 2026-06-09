import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

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

    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: 'tagIds 必须是数组' }, { status: 400 });
    }

    if (tagIds.length > 10) {
      return NextResponse.json({ error: '每个对话最多 10 个标签' }, { status: 400 });
    }

    if (!tagIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json({ error: 'tagIds 的每个元素必须是非空字符串' }, { status: 400 });
    }

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
