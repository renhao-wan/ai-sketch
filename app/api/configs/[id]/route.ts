import { NextResponse } from 'next/server';
import { configManager } from '@/lib/db/config-manager';
import type { LLMConfig } from '@/types';

/**
 * GET /api/configs/[id]
 * Get a single config by ID
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const config = await configManager.getConfig(id);
    if (!config) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    }
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/configs/[id]
 * Update a config
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = (await request.json()) as Partial<LLMConfig>;
    const config = await configManager.updateConfig(id, data);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/configs/[id]
 * Delete a config
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await configManager.deleteConfig(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting config:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
