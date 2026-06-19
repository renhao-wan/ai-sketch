import { getDb } from './index';
import { requestSave } from './index';

export interface CustomAction {
  id: string;
  name: string;
  prompt: string;
  icon: string;
  action_type: 'modify' | 'explain';
  enabled: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface CanvasAction {
  id: string;
  action_type: 'builtin' | 'custom';
  action_id: string;
  sort_order: number;
}

class CustomActionManager {
  async getAll(): Promise<CustomAction[]> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM custom_actions ORDER BY sort_order');
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0] as string,
      name: row[1] as string,
      prompt: row[2] as string,
      icon: row[3] as string,
      action_type: row[4] as 'modify' | 'explain',
      enabled: row[5] as number,
      sort_order: row[6] as number,
      created_at: row[7] as number,
      updated_at: row[8] as number,
    }));
  }

  async getById(id: string): Promise<CustomAction | null> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM custom_actions WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row = result[0].values[0];
    return {
      id: row[0] as string,
      name: row[1] as string,
      prompt: row[2] as string,
      icon: row[3] as string,
      action_type: row[4] as 'modify' | 'explain',
      enabled: row[5] as number,
      sort_order: row[6] as number,
      created_at: row[7] as number,
      updated_at: row[8] as number,
    };
  }

  async create(data: Omit<CustomAction, 'id' | 'created_at' | 'updated_at'>): Promise<CustomAction> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = Date.now();

    db.run(
      `INSERT INTO custom_actions (id, name, prompt, icon, action_type, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.prompt, data.icon, data.action_type, data.enabled, data.sort_order, now, now]
    );

    requestSave();
    return this.getById(id) as Promise<CustomAction>;
  }

  async update(id: string, data: Partial<Omit<CustomAction, 'id' | 'created_at' | 'updated_at'>>): Promise<CustomAction | null> {
    const db = await getDb();
    const now = Date.now();

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.prompt !== undefined) {
      fields.push('prompt = ?');
      values.push(data.prompt);
    }
    if (data.icon !== undefined) {
      fields.push('icon = ?');
      values.push(data.icon);
    }
    if (data.action_type !== undefined) {
      fields.push('action_type = ?');
      values.push(data.action_type);
    }
    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(data.enabled);
    }
    if (data.sort_order !== undefined) {
      fields.push('sort_order = ?');
      values.push(data.sort_order);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.run(
      `UPDATE custom_actions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    requestSave();
    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    db.run('DELETE FROM custom_actions WHERE id = ?', [id]);
    db.run('DELETE FROM canvas_actions WHERE action_type = ? AND action_id = ?', ['custom', id]);
    requestSave();
    return true;
  }

  async getCanvasActions(): Promise<CanvasAction[]> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM canvas_actions ORDER BY sort_order');
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0] as string,
      action_type: row[1] as 'builtin' | 'custom',
      action_id: row[2] as string,
      sort_order: row[3] as number,
    }));
  }

  async updateCanvasActions(actions: Omit<CanvasAction, 'id'>[]): Promise<void> {
    const db = await getDb();

    // 删除所有现有记录
    db.run('DELETE FROM canvas_actions');

    // 插入新记录
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      db.run(
        'INSERT INTO canvas_actions (id, action_type, action_id, sort_order) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), action.action_type, action.action_id, i]
      );
    }

    requestSave();
  }
}

export const customActionManager = new CustomActionManager();
