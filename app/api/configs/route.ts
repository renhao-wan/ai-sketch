import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/llm-client';
import type { LLMConfig } from '@/types';

/**
 * POST /api/configs
 * Test connection to a provider API
 */
export async function POST(request: Request) {
  try {
    const { config } = await request.json() as { config: LLMConfig };

    if (!config) {
      return NextResponse.json(
        { error: 'Missing required parameter: config' },
        { status: 400 },
      );
    }

    const result = await testConnection(config);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json(
      {
        success: false,
        message: (error as Error).message || '连接测试失败',
      },
      { status: 500 },
    );
  }
}
