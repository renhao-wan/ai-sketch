import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/db/cache-manager';
import type { CacheLevel } from '@/lib/cache/cache-key';

export async function GET() {
  try {
    const level = await cacheManager.getLevel();
    return NextResponse.json({ level });
  } catch (error) {
    console.error('Error fetching cache level:', error);
    const message = process.env.NODE_ENV === 'development'
      ? (error as Error).message
      : '获取缓存档位失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { level } = body;

    // 类型校验
    if (level !== 'strict' && level !== 'normal' && level !== 'loose') {
      return NextResponse.json({ error: 'level 必须是 strict、normal 或 loose' }, { status: 400 });
    }

    await cacheManager.setLevel(level as CacheLevel);
    return NextResponse.json({ success: true, level });
  } catch (error) {
    console.error('Error setting cache level:', error);
    const message = process.env.NODE_ENV === 'development'
      ? (error as Error).message
      : '设置缓存档位失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
