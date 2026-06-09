import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/db/cache-manager';

export async function GET() {
  try {
    const stats = await cacheManager.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
