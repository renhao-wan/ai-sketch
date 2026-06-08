import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/**
 * GET /api/config-tags
 * 获取所有配置标签
 */
export const GET = withErrorHandling(async () => {
  const tags = await tagManager.getConfigTags();
  return NextResponse.json({ tags });
}, '/api/config-tags GET');

/**
 * POST /api/config-tags
 * 创建配置标签
 * Body: { name: string; color: string }
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { name, color } = body;

  if (!name || !color) {
    return NextResponse.json({ error: '缺少必填参数: name, color' }, { status: 400 });
  }

  if (name.length > 20) {
    return NextResponse.json({ error: '标签名称不能超过 20 个字符' }, { status: 400 });
  }

  // 检查同名标签
  const existing = await tagManager.getConfigTags();
  if (existing.some(t => t.name === name.trim())) {
    return NextResponse.json({ error: '同名标签已存在' }, { status: 409 });
  }

  const tag = await tagManager.createConfigTag({ name: name.trim(), color });
  return NextResponse.json(tag);
}, '/api/config-tags POST');
