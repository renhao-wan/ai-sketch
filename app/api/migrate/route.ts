import { NextResponse } from 'next/server';
import { configManager } from '@/lib/config-manager';
import { historyManager } from '@/lib/history-manager';
import type { LLMConfig, HistoryItem } from '@/types';

/**
 * POST /api/migrate
 * Migrate localStorage data to SQLite
 * Body: { configs?, activeConfigId?, histories? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { configs, activeConfigId, histories } = body as {
      configs?: LLMConfig[];
      activeConfigId?: string;
      histories?: HistoryItem[];
    };

    let migratedConfigs = 0;
    let migratedHistories = 0;

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

    if (histories && Array.isArray(histories)) {
      for (const item of histories) {
        await historyManager.addHistory({
          chartType: item.chartType,
          userInput: item.userInput,
          generatedCode: item.generatedCode,
          config: item.config || {},
        });
        migratedHistories++;
      }
    }

    return NextResponse.json({
      migrated: { configs: migratedConfigs, histories: migratedHistories },
    });
  } catch (error) {
    console.error('Error during migration:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
