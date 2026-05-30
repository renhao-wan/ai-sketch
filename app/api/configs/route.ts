import { NextResponse } from 'next/server';
import { configManager } from '@/lib/db/config-manager';
import type { LLMConfig } from '@/types';

/**
 * GET /api/configs
 * List all configs and active config ID
 */
export async function GET() {
  try {
    const configs = await configManager.getAllConfigs();
    const activeConfigId = await configManager.getActiveConfigId();
    return NextResponse.json({ configs, activeConfigId });
  } catch (error) {
    console.error('Error fetching configs:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/configs
 * Create a new config or test connection
 * Body: { action: 'create', config } or { action: 'test', config } or { config } (backward compat = test)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, config } = body as { action?: string; config: LLMConfig };

    if (!config) {
      return NextResponse.json({ error: 'Missing required parameter: config' }, { status: 400 });
    }

    if (action === 'create') {
      const newConfig = await configManager.createConfig(config);
      return NextResponse.json(newConfig);
    }

    // Default: test connection (backward compat)
    const result = await configManager.testConnectionAction(config);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/configs:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message || '操作失败' },
      { status: 500 },
    );
  }
}
