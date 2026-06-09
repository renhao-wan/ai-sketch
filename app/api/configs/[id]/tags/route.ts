import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/**
 * PUT /api/configs/:id/tags
 * 设置配置标签（替换）
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
      return NextResponse.json({ error: '每个配置最多 10 个标签' }, { status: 400 });
    }

    if (!tagIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json({ error: 'tagIds 的每个元素必须是非空字符串' }, { status: 400 });
    }

    await tagManager.setConfigTags(id, tagIds);
    const tags = await tagManager.getConfigTagsByIds(id);
    return NextResponse.json({ tags });
  },
  '/api/configs/[id]/tags PUT',
);

/**
 * GET /api/configs/:id/tags
 * 获取配置标签
 */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const tags = await tagManager.getConfigTagsByIds(id);
    return NextResponse.json({ tags });
  },
  '/api/configs/[id]/tags GET',
);
