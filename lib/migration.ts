import type { LLMConfig } from '@/types';

const MIGRATION_FLAG = 'smart-excalidraw-migrated';

export async function runMigrationIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const configsRaw = localStorage.getItem('smart-excalidraw-configs');
  const activeConfigId = localStorage.getItem('smart-excalidraw-active-config') || undefined;

  if (!configsRaw) {
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return;
  }

  const payload: { configs?: LLMConfig[]; activeConfigId?: string } = {};
  if (configsRaw) {
    try { payload.configs = JSON.parse(configsRaw); } catch { /* ignore */ }
  }
  if (activeConfigId) payload.activeConfigId = activeConfigId;

  try {
    await fetch('/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Migration failed:', error);
  }

  // Clean up localStorage regardless of migration success
  localStorage.removeItem('smart-excalidraw-configs');
  localStorage.removeItem('smart-excalidraw-active-config');
  localStorage.removeItem('smart-excalidraw-config'); // legacy key
  localStorage.setItem(MIGRATION_FLAG, 'true');
}
