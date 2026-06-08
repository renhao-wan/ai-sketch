import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

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

  if (!name || !color) {
    return NextResponse.json({ error: '缺少必填参数: name, color' }, { status: 400 });
  }

  if (name.length > 20) {
    return NextResponse.json({ error: '标签名称不能超过 20 个字符' }, { status: 400 });
  }

  const tag = await tagManager.createConversationTag({ name, color });
  return NextResponse.json(tag);
}, '/api/conversation-tags POST');
