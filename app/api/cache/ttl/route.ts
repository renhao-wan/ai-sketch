import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/db/cache-manager';

export async function GET() {
  try {
    const ttlDays = await cacheManager.getTtl();
    return NextResponse.json({ ttlDays });
  } catch (error) {
    console.error('Error fetching cache TTL:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ttlDays } = body as { ttlDays: number };
    await cacheManager.setTtl(ttlDays);
    return NextResponse.json({ success: true, ttlDays });
  } catch (error) {
    console.error('Error setting cache TTL:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
