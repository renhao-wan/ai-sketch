import { NextResponse } from 'next/server';
import { configManager } from '@/lib/config-manager';
import type { LLMConfig } from '@/types';

/**
 * POST /api/migrate
 * Migrate localStorage data to SQLite
 * Body: { configs?, activeConfigId? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { configs, activeConfigId } = body as {
      configs?: LLMConfig[];
      activeConfigId?: string;
    };

    let migratedConfigs = 0;

    if (configs && Array.isArray(configs)) {
      for (const configData of configs) {
        const existing = configData.id ? await configManager.getConfig(configData.id) : null;
        if (!existing) {
          await configManager.createConfig({
            ...configData,
            id: configData.id,
            isActive: false,
          });
          migratedConfigs++;
        }
      }
    }

    if (activeConfigId) {
      try {
        await configManager.setActiveConfig(activeConfigId);
      } catch {
        // Config may not exist if migration data is inconsistent
      }
    }

    return NextResponse.json({
      migrated: { configs: migratedConfigs },
    });
  } catch (error) {
    console.error('Error during migration:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
