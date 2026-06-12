import { NextResponse } from 'next/server';
import { configManager } from '@/lib/db/config-manager';
import type { LLMConfig } from '@/lib/types';

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
 * 创建新配置
 * Body: { config: LLMConfig }
 *
 * 注意：测试连接请使用 POST /api/configs/test
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { config } = body as { config: LLMConfig };

    if (!config) {
      return NextResponse.json({ error: '缺少必要参数: config' }, { status: 400 });
    }

    const newConfig = await configManager.createConfig(config);
    return NextResponse.json(newConfig);
  } catch (error) {
    console.error('Error in POST /api/configs:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message || '创建配置失败' },
      { status: 500 },
    );
  }
}
