import { NextResponse } from 'next/server';
import { configManager } from '@/lib/db/config-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';
import type { LLMConfig } from '@/lib/types';

/**
 * GET /api/configs/[id]
 * Get a single config by ID
 */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const config = await configManager.getConfig(id);
  if (!config) {
    return NextResponse.json({ error: '配置不存在' }, { status: 404 });
  }
  return NextResponse.json(config);
}, '/api/configs/[id] GET');

/**
 * PUT /api/configs/[id]
 * Update a config
 */
export const PUT = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const data = (await request.json()) as Partial<LLMConfig>;
  const config = await configManager.updateConfig(id, data);
  return NextResponse.json(config);
}, '/api/configs/[id] PUT');

/**
 * DELETE /api/configs/[id]
 * Delete a config
 */
export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await configManager.deleteConfig(id);
  return NextResponse.json({ success: true });
}, '/api/configs/[id] DELETE');
