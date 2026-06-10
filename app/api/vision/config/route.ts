/**
 * Vision Config CRUD API
 * GET  — 获取当前配置
 * PUT  — 保存配置
 * DELETE — 删除配置
 */

import { NextResponse } from 'next/server';
import { getVisionConfig, saveVisionConfig, deleteVisionConfig } from '@/lib/db/vision-config';

export async function GET() {
  try {
    const config = await getVisionConfig();
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { apiType, baseUrl, apiKey, model } = body;

    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: baseUrl, apiKey, model' },
        { status: 400 },
      );
    }

    const config = await saveVisionConfig({
      apiType: apiType || 'openai',
      baseUrl,
      apiKey,
      model,
    });

    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await deleteVisionConfig();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
