import { NextResponse } from 'next/server';
import { fetchModels } from '@/lib/llm/client';
import { configManager } from '@/lib/db/config-manager';

/**
 * GET /api/models
 * Fetch available models from the configured provider
 * Supports two modes:
 *   - ?configId=xxx — server looks up config by ID
 *   - ?type=...&baseUrl=...&apiKey=... — direct params (backward compat)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');
    let type = searchParams.get('type');
    let baseUrl = searchParams.get('baseUrl');
    let apiKey = searchParams.get('apiKey');

    if (configId) {
      const config = await configManager.getConfig(configId);
      if (!config) {
        return NextResponse.json({ error: `配置不存在: ${configId}` }, { status: 404 });
      }
      type = config.type;
      baseUrl = config.baseUrl;
      apiKey = config.apiKey;
    }

    if (!type || !baseUrl || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: configId or type, baseUrl, apiKey' },
        { status: 400 },
      );
    }

    const models = await fetchModels(type, baseUrl, apiKey);

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch models' },
      { status: 500 },
    );
  }
}
