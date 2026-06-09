import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/**
 * POST /api/configs/tags/batch
 * 批量获取多个配置的标签
 * Body: { ids: string[] }
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids 必须是非空数组' }, { status: 400 });
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: '单次最多查询 100 个配置' }, { status: 400 });
  }

  const tagsMap = await tagManager.getConfigTagsBatch(ids);
  return NextResponse.json({ tagsMap });
}, '/api/configs/tags/batch POST');
