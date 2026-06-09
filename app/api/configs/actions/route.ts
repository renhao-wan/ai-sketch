import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
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

  'get-retries': async () => {
    const maxRetries = await configManager.getMaxRetries();
    return { maxRetries };
  },

  'set-retries': async (body) => {
    await configManager.setMaxRetries(body.maxRetries as number);
    return { success: true };
  },

  'reset-meta': async () => {
    await configManager.resetMeta();
    return { success: true };
  },

  'get-preference': async (body) => {
    const value = await configManager.getPreference(body.key as string);
    return { value };
  },

  'set-preference': async (body) => {
    await configManager.setPreference(body.key as string, body.value as string);
    return { success: true };
  },

  'get-all-preferences': async (body) => {
    const keys = body.keys as string[];
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = await configManager.getPreference(key);
    }
    return result;
  },

  'reset-window-state': async () => {
    // 窗口状态文件位于 userData 根目录（数据库文件所在目录的上两级）
    const dbPath = process.env.AI_SKETCH_DB_PATH || path.join(process.cwd(), 'data', 'ai-sketch.db');
    const userDataDir = path.dirname(path.dirname(dbPath));
    const stateFile = path.join(userDataDir, 'window-state.json');
    try {
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }
    } catch (e) {
      console.error('Failed to delete window-state.json:', e);
    }
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
