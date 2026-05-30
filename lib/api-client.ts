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

export async function fetchConversations(limit?: number): Promise<Conversation[]> {
  const url = limit ? `/api/conversations?limit=${limit}` : '/api/conversations';
  const data = await request<{ conversations: Conversation[] }>(url);
  return data.conversations;
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  return request(`/api/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await request<{ success: boolean }>(`/api/conversations/${id}`, { method: 'DELETE' });
}

export async function clearAllConversations(): Promise<void> {
  await request<{ success: boolean }>('/api/conversations', { method: 'DELETE' });
}
