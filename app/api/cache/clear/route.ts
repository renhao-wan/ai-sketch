import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/db/cache-manager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, configName, model } = body as {
      type: 'all' | 'expired' | 'byConfig';
      configName?: string;
      model?: string;
    };

    switch (type) {
      case 'all':
        await cacheManager.clearAll();
        return NextResponse.json({ success: true });

      case 'expired': {
        const count = await cacheManager.clearExpired();
        return NextResponse.json({ success: true, count });
      }

      case 'byConfig': {
        if (!configName || !model) {
          return NextResponse.json({ error: 'configName 和 model 为必填' }, { status: 400 });
        }
        const count = await cacheManager.clearByConfig(configName, model);
        return NextResponse.json({ success: true, count });
      }

      default:
        return NextResponse.json({ error: `未知类型: ${type}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
