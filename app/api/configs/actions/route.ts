import { NextResponse } from 'next/server';
import { configManager } from '@/lib/db/config-manager';

/** Action 处理函数类型 */
type ActionHandler = (body: Record<string, unknown>) => Promise<unknown>;

/** Action 命令注册表 */
const actionHandlers: Record<string, ActionHandler> = {
  'set-active': async (body) => {
    await configManager.setActiveConfig(body.configId as string);
    return { success: true };
  },

  'clone': async (body) => {
    return configManager.cloneConfig(body.configId as string, body.newName as string | undefined);
  },

  'import': async (body) => {
    return configManager.importConfigs(body.configs as string);
  },

  'export': async () => {
    const json = await configManager.exportConfigs();
    return { data: json };
  },

  'search': async (body) => {
    return configManager.searchConfigs(body.query as string);
  },

  'stats': async () => {
    return configManager.getStats();
  },

  'get-proxy': async () => {
    return configManager.getProxy();
  },

  'set-proxy': async (body) => {
    await configManager.setProxy(
      (body.proxyUrl as string) || 'http://127.0.0.1:7890',
      !!body.proxyEnabled,
    );
    return { success: true };
  },
};

/**
 * POST /api/configs/actions
 * Body: { action, ...params }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    const handler = actionHandlers[action];
    if (!handler) {
      return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
    }

    const result = await handler(body as Record<string, unknown>);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/configs/actions:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
