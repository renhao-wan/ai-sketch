import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/db/cache-manager';

export async function GET() {
  try {
    const ttlDays = await cacheManager.getTtl();
    return NextResponse.json({ ttlDays });
  } catch (error) {
    console.error('Error fetching cache TTL:', error);
    const message = process.env.NODE_ENV === 'development'
      ? (error as Error).message
      : '获取缓存 TTL 失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ttlDays } = body;

    // 类型和范围校验
    if (typeof ttlDays !== 'number' || !isFinite(ttlDays)) {
      return NextResponse.json({ error: 'ttlDays 必须是有效数字' }, { status: 400 });
    }
    if (ttlDays < 1 || ttlDays > 365) {
      return NextResponse.json({ error: 'ttlDays 必须在 1-365 之间' }, { status: 400 });
    }

    await cacheManager.setTtl(ttlDays);
    return NextResponse.json({ success: true, ttlDays });
  } catch (error) {
    console.error('Error setting cache TTL:', error);
    const message = process.env.NODE_ENV === 'development'
      ? (error as Error).message
      : '设置缓存 TTL 失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
