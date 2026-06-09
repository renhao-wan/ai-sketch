import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';
import { validateTagIds } from '@/app/api/_lib/tag-validation';

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

    const error = validateTagIds(tagIds);
    if (error) return error;

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
