import type { LLMConfig, TestConnectionResult, Conversation, ConversationWithMessages } from '@/types';

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
