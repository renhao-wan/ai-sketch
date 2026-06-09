import { NextResponse } from 'next/server';

/** 校验标签名称，返回错误响应或 null */
export function validateTagName(name: unknown): NextResponse | null {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name 必须是非空字符串' }, { status: 400 });
  }
  if (name.trim().length > 20) {
    return NextResponse.json({ error: '标签名称不能超过 20 个字符' }, { status: 400 });
  }
  return null;
}

/** 校验标签颜色，返回错误响应或 null */
export function validateTagColor(color: unknown): NextResponse | null {
  if (!color || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: 'color 必须是有效的十六进制颜色值' }, { status: 400 });
  }
  return null;
}

/** 校验 tagIds 数组，返回错误响应或 null */
export function validateTagIds(tagIds: unknown): NextResponse | null {
  if (!Array.isArray(tagIds)) {
    return NextResponse.json({ error: 'tagIds 必须是数组' }, { status: 400 });
  }
  if (tagIds.length > 10) {
    return NextResponse.json({ error: '每个实体最多 10 个标签' }, { status: 400 });
  }
  if (!tagIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
    return NextResponse.json({ error: 'tagIds 的每个元素必须是非空字符串' }, { status: 400 });
  }
  return null;
}
