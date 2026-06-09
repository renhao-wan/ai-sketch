import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';
import { validateTagName, validateTagColor } from '@/app/api/_lib/tag-validation';

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

  const nameError = validateTagName(name);
  if (nameError) return nameError;

  const colorError = validateTagColor(color);
  if (colorError) return colorError;

  // 检查同名标签
  const existing = await tagManager.getConfigTags();
  if (existing.some(t => t.name === (name as string).trim())) {
    return NextResponse.json({ error: '同名标签已存在' }, { status: 409 });
  }

  const tag = await tagManager.createConfigTag({ name: (name as string).trim(), color });
  return NextResponse.json(tag);
}, '/api/config-tags POST');
