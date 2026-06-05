import { NextResponse } from 'next/server';
import { conversationManager } from '@/lib/db/conversation-manager';
import { withErrorHandling } from '@/lib/api/with-error-handling';

/**
 * GET /api/conversations/[id]
 * Get a single conversation with all its messages
 */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const conversation = await conversationManager.getById(id);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  return NextResponse.json(conversation);
}, '/api/conversations/[id] GET');

/**
 * PATCH /api/conversations/[id]
 * Update conversation fields (e.g. title)
 */
export const PATCH = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();
  const updated = await conversationManager.update(id, body);
  if (!updated) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}, '/api/conversations/[id] PATCH');

/**
 * DELETE /api/conversations/[id]
 * Delete a single conversation and its messages
 */
export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await conversationManager.delete(id);
  return NextResponse.json({ success: true });
}, '/api/conversations/[id] DELETE');
