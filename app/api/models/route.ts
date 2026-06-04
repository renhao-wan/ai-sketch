import { NextResponse } from 'next/server';
import { fetchModels } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';

/**
 * GET /api/models?configId=xxx
 * 通过配置 ID 获取可用模型（安全模式，不暴露 API Key）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');

    if (!configId) {
      return NextResponse.json(
        { error: '缺少参数: configId' },
        { status: 400 },
      );
    }

    const config = await configManager.getConfig(configId);
    if (!config) {
      return NextResponse.json({ error: `配置不存在: ${configId}` }, { status: 404 });
    }

    const models = await fetchModels(config.type, config.baseUrl, config.apiKey);
    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : '获取模型列表失败' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/models
 * 通过请求体传递配置获取模型（API Key 不走 URL）
 * Body: { type, baseUrl, apiKey }
 */
export async function POST(request: Request) {
  try {
    const { type, baseUrl, apiKey } = await request.json();

    if (!type || !baseUrl || !apiKey) {
      return NextResponse.json(
        { error: '缺少必要参数: type, baseUrl, apiKey' },
        { status: 400 },
      );
    }

    const models = await fetchModels(type, baseUrl, apiKey);
    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : '获取模型列表失败' },
      { status: 500 },
    );
  }
}
