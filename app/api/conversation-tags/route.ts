import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';
import { validateTagName, validateTagColor } from '@/app/api/_lib/tag-validation';

/**
 * GET /api/conversation-tags
 * 获取所有对话标签
 */
export const GET = withErrorHandling(async () => {
  const tags = await tagManager.getConversationTags();
  return NextResponse.json({ tags });
}, '/api/conversation-tags GET');

/**
 * POST /api/conversation-tags
 * 创建对话标签
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
  const existing = await tagManager.getConversationTags();
  if (existing.some(t => t.name === (name as string).trim())) {
    return NextResponse.json({ error: '同名标签已存在' }, { status: 409 });
  }

  const tag = await tagManager.createConversationTag({ name: (name as string).trim(), color });
  return NextResponse.json(tag);
}, '/api/conversation-tags POST');
