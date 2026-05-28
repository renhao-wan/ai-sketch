import { getDb, saveToDisk } from './db';
import type { HistoryItem, LLMConfig } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

interface AddHistoryData {
  chartType: string;
  format?: DiagramFormat;
  userInput: string;
  generatedCode: string;
  config: Partial<LLMConfig>;
}

interface HistoryRow {
  id: string;
  chart_type: string;
  user_input: string;
  generated_code: string;
  config_name: string | null;
  config_model: string | null;
  timestamp: number;
  format: string | null;
}

function rowToHistoryItem(row: HistoryRow): HistoryItem {
  return {
    id: row.id,
    chartType: row.chart_type,
    format: (row.format as DiagramFormat) || 'excalidraw',
    userInput: row.user_input,
    generatedCode: row.generated_code,
    config: {
      name: row.config_name || undefined,
      model: row.config_model || undefined,
    },
    timestamp: row.timestamp,
  };
}

class HistoryManager {
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async addHistory(data: AddHistoryData): Promise<HistoryItem> {
    const db = await getDb();
    const id = this.generateId();
    const timestamp = Date.now();

    db.run(
      `INSERT INTO history (id, chart_type, user_input, generated_code, config_name, config_model, timestamp, format)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.chartType,
        data.userInput,
        data.generatedCode,
        data.config.name || null,
        data.config.model || null,
        timestamp,
        data.format || 'excalidraw',
      ],
    );

    saveToDisk();

    return {
      id,
      chartType: data.chartType,
      format: data.format || 'excalidraw',
      userInput: data.userInput,
      generatedCode: data.generatedCode,
      config: data.config,
      timestamp,
    };
  }

  async getHistories(): Promise<HistoryItem[]> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM history ORDER BY timestamp DESC');
    if (result.length === 0) return [];
    return result[0].values.map((row: unknown[]) =>
      rowToHistoryItem({
        id: row[0] as string,
        chart_type: row[1] as string,
        user_input: row[2] as string,
        generated_code: row[3] as string,
        config_name: row[4] as string | null,
        config_model: row[5] as string | null,
        timestamp: row[6] as number,
        format: (row[7] as string) || null,
      }),
    );
  }

  async deleteHistory(id: string): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM history WHERE id = ?', [id]);
    saveToDisk();
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM history');
    saveToDisk();
  }
}

export const historyManager = new HistoryManager();
