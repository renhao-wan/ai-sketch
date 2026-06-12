import { NextResponse } from 'next/server';
import { configManager } from '@/lib/db/config-manager';
import type { LLMConfig } from '@/lib/types';

/**
 * POST /api/configs/test
 * 测试 LLM 配置连接
 * Body: { config: LLMConfig }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { config } = body as { config: LLMConfig };

    if (!config) {
      return NextResponse.json({ error: '缺少必要参数: config' }, { status: 400 });
    }

    const result = await configManager.testConnectionAction(config);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/configs/test:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message || '测试连接失败' },
      { status: 500 },
    );
  }
}
