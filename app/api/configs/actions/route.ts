import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { configManager } from '@/lib/db/config-manager';

/** Action 处理函数类型 */
type ActionHandler = (body: Record<string, unknown>) => Promise<unknown>;

/** 从对象中提取指定类型的字段值 */
function getString(body: Record<string, unknown>, key: string): string | undefined {
  const val = body[key];
  return typeof val === 'string' ? val : undefined;
}

function getNumber(body: Record<string, unknown>, key: string, min: number, max: number): number | undefined {
  const val = body[key];
  if (typeof val !== 'number' || !isFinite(val)) return undefined;
  return Math.min(Math.max(val, min), max);
}

function getStringArray(body: Record<string, unknown>, key: string, maxLen: number): string[] | undefined {
  const val = body[key];
  if (!Array.isArray(val)) return undefined;
  const arr = val.filter((v): v is string => typeof v === 'string');
  return arr.length > maxLen ? arr.slice(0, maxLen) : arr;
}

/** Action 命令注册表 */
const actionHandlers: Record<string, ActionHandler> = {
  'set-active': async (body) => {
    const configId = getString(body, 'configId');
    if (!configId) throw new Error('configId 必须是非空字符串');
    await configManager.setActiveConfig(configId);
    return { success: true };
  },

  'clone': async (body) => {
    const configId = getString(body, 'configId');
    if (!configId) throw new Error('configId 必须是非空字符串');
    return configManager.cloneConfig(configId, getString(body, 'newName'));
  },

  'import': async (body) => {
    const configs = getString(body, 'configs');
    if (!configs) throw new Error('configs 必须是非空字符串');
    // 限制导入数据大小（1MB）
    if (configs.length > 1024 * 1024) throw new Error('导入数据过大，最大支持 1MB');
    return configManager.importConfigs(configs);
  },

  'export': async () => {
    const json = await configManager.exportConfigs();
    return { data: json };
  },

  'search': async (body) => {
    const query = getString(body, 'query') ?? '';
    return configManager.searchConfigs(query);
  },

  'stats': async () => {
    return configManager.getStats();
  },

  'get-proxy': async () => {
    return configManager.getProxy();
  },

  'set-proxy': async (body) => {
    await configManager.setProxy(
      getString(body, 'proxyUrl') || 'http://127.0.0.1:7890',
      !!body.proxyEnabled,
    );
    return { success: true };
  },

  'get-retries': async () => {
    const maxRetries = await configManager.getMaxRetries();
    return { maxRetries };
  },

  'set-retries': async (body) => {
    const maxRetries = getNumber(body, 'maxRetries', 0, 5);
    if (maxRetries === undefined) throw new Error('maxRetries 必须是 0-5 之间的数字');
    await configManager.setMaxRetries(maxRetries);
    return { success: true };
  },

  'reset-meta': async () => {
    await configManager.resetMeta();
    return { success: true };
  },

  'get-preference': async (body) => {
    const key = getString(body, 'key');
    if (!key) throw new Error('key 必须是非空字符串');
    const value = await configManager.getPreference(key);
    return { value };
  },

  'set-preference': async (body) => {
    const key = getString(body, 'key');
    if (!key) throw new Error('key 必须是非空字符串');
    const value = getString(body, 'value');
    if (value === undefined) throw new Error('value 必须是字符串');
    await configManager.setPreference(key, value);
    return { success: true };
  },

  'get-all-preferences': async (body) => {
    const keys = getStringArray(body, 'keys', 50);
    if (!keys || keys.length === 0) throw new Error('keys 必须是非空字符串数组，最多 50 个');
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
