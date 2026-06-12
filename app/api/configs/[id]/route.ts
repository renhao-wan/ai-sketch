import { NextResponse } from 'next/server';
import { configManager } from '@/lib/db/config-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/** configs PUT 允许更新的字段白名单 */
const CONFIG_UPDATE_ALLOWED = ['name', 'type', 'baseUrl', 'apiKey', 'model', 'description', 'enabled', 'temperature', 'maxTokens'] as const;

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
 * Update a config（仅允许白名单字段）
 */
export const PUT = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const rawData = await request.json();
  // 字段白名单过滤，防止覆盖 id/isActive/createdAt 等不应由客户端修改的字段
  const data = Object.fromEntries(
    Object.entries(rawData).filter(([k]) => (CONFIG_UPDATE_ALLOWED as readonly string[]).includes(k))
  );
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
