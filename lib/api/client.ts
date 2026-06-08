import type { LLMConfig, TestConnectionResult, Conversation, ConversationWithMessages, ConversationTag, ConfigTag } from '@/lib/types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return res.json();
}

// ── Config operations ──

export async function fetchConfigs(): Promise<{ configs: LLMConfig[]; activeConfigId: string | null }> {
  return request('/api/configs');
}

export async function createConfig(data: Partial<LLMConfig>): Promise<LLMConfig> {
  return request('/api/configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', config: data }),
  });
}

export async function updateConfig(id: string, data: Partial<LLMConfig>): Promise<LLMConfig> {
  return request(`/api/configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteConfig(id: string): Promise<void> {
  await request<{ success: boolean }>(`/api/configs/${id}`, { method: 'DELETE' });
}

export async function setActiveConfig(id: string): Promise<void> {
  await request<{ success: boolean }>('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set-active', configId: id }),
  });
}

export async function cloneConfig(id: string, newName?: string): Promise<LLMConfig> {
  return request('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'clone', configId: id, newName }),
  });
}

export async function testConnection(config: Partial<LLMConfig>): Promise<TestConnectionResult> {
  return request('/api/configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'test', config }),
  });
}

export async function exportConfigs(): Promise<string> {
  const data = await request<{ data: string }>('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'export' }),
  });
  return data.data;
}

export async function importConfigs(configsJson: string): Promise<{ success: boolean; count?: number; message?: string }> {
  return request('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'import', configs: configsJson }),
  });
}

export async function searchConfigs(query: string): Promise<LLMConfig[]> {
  return request('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', query }),
  });
}

export async function clearCache(): Promise<{ success: boolean }> {
  return request('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'clear-cache' }),
  });
}

export async function resetMeta(): Promise<{ success: boolean }> {
  return request('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset-meta' }),
  });
}

export async function fetchCacheStats(): Promise<{ total: number; avgUseCount: number }> {
  return request('/api/configs/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cache-stats' }),
  });
}

// ── Migration ──

export async function migrateFromLocalStorage(data: {
  configs?: LLMConfig[];
  activeConfigId?: string;
}): Promise<{ migrated: { configs: number } }> {
  return request('/api/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ── Conversation operations ──

export async function fetchConversations(params?: {
  search?: string;
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  conversations: Conversation[];
  total: number;
  hasMore: boolean;
}> {
  const searchParams = new URLSearchParams();

  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  const url = `/api/conversations${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return request(url);
}

export async function fetchConversationCount(): Promise<{
  count: number;
  limit: number;
}> {
  return request('/api/conversations/count');
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  return request(`/api/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await request<{ success: boolean }>(`/api/conversations/${id}`, { method: 'DELETE' });
}

export async function updateConversationTitle(id: string, title: string): Promise<Conversation> {
  return request<Conversation>(`/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export async function clearAllConversations(): Promise<void> {
  await request<{ success: boolean }>('/api/conversations', { method: 'DELETE' });
}

export async function deleteConversations(ids: string[]): Promise<void> {
  await request<{ success: boolean }>('/api/conversations', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

// ── Tag operations ──

/** 获取所有对话标签 */
export async function fetchConversationTags(): Promise<ConversationTag[]> {
  const data = await request<{ tags: ConversationTag[] }>('/api/conversation-tags');
  return data.tags;
}

/** 创建对话标签 */
export async function createConversationTag(data: { name: string; color: string }): Promise<ConversationTag> {
  return request('/api/conversation-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 更新对话标签 */
export async function updateConversationTag(id: string, data: { name?: string; color?: string }): Promise<ConversationTag> {
  return request(`/api/conversation-tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 删除对话标签 */
export async function deleteConversationTag(id: string): Promise<void> {
  await request<{ success: boolean }>(`/api/conversation-tags/${id}`, { method: 'DELETE' });
}

/** 设置对话标签 */
export async function setConversationTags(conversationId: string, tagIds: string[]): Promise<{ tags: ConversationTag[] }> {
  return request(`/api/conversations/${conversationId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagIds }),
  });
}

/** 获取对话标签 */
export async function fetchConversationTagsByIds(conversationId: string): Promise<ConversationTag[]> {
  const data = await request<{ tags: ConversationTag[] }>(`/api/conversations/${conversationId}/tags`);
  return data.tags;
}

/** 获取所有配置标签 */
export async function fetchConfigTags(): Promise<ConfigTag[]> {
  const data = await request<{ tags: ConfigTag[] }>('/api/config-tags');
  return data.tags;
}

/** 创建配置标签 */
export async function createConfigTag(data: { name: string; color: string }): Promise<ConfigTag> {
  return request('/api/config-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 更新配置标签 */
export async function updateConfigTag(id: string, data: { name?: string; color?: string }): Promise<ConfigTag> {
  return request(`/api/config-tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 删除配置标签 */
export async function deleteConfigTag(id: string): Promise<void> {
  await request<{ success: boolean }>(`/api/config-tags/${id}`, { method: 'DELETE' });
}

/** 设置配置标签 */
export async function setConfigTags(configId: string, tagIds: string[]): Promise<{ tags: ConfigTag[] }> {
  return request(`/api/configs/${configId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagIds }),
  });
}

/** 获取配置标签 */
export async function fetchConfigTagsByIds(configId: string): Promise<ConfigTag[]> {
  const data = await request<{ tags: ConfigTag[] }>(`/api/configs/${configId}/tags`);
  return data.tags;
}
