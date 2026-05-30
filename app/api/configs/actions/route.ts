import { NextResponse } from 'next/server';
import { configManager } from '@/lib/db/config-manager';

/**
 * POST /api/configs/actions
 * Body: { action, ...params }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    switch (action) {
      case 'set-active': {
        const { configId } = body as { configId: string };
        await configManager.setActiveConfig(configId);
        return NextResponse.json({ success: true });
      }

      case 'clone': {
        const { configId, newName } = body as { configId: string; newName?: string };
        const cloned = await configManager.cloneConfig(configId, newName);
        return NextResponse.json(cloned);
      }

      case 'import': {
        const { configs } = body as { configs: string };
        const result = await configManager.importConfigs(configs);
        return NextResponse.json(result);
      }

      case 'export': {
        const json = await configManager.exportConfigs();
        return NextResponse.json({ data: json });
      }

      case 'search': {
        const { query } = body as { query: string };
        const results = await configManager.searchConfigs(query);
        return NextResponse.json(results);
      }

      case 'stats': {
        const stats = await configManager.getStats();
        return NextResponse.json(stats);
      }

      default:
        return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in /api/configs/actions:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
