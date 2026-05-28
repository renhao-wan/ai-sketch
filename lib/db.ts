import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'ai-sketch.db');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(buffer);
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run('PRAGMA journal_mode = WAL');

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS llm_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      chart_type TEXT NOT NULL,
      user_input TEXT NOT NULL,
      generated_code TEXT NOT NULL,
      config_name TEXT,
      config_model TEXT,
      timestamp INTEGER NOT NULL,
      format TEXT DEFAULT 'excalidraw'
    )
  `);

  // Migration: add format column if it doesn't exist (for existing databases)
  try {
    dbInstance.run(`ALTER TABLE history ADD COLUMN format TEXT DEFAULT 'excalidraw'`);
  } catch {
    // Column already exists, ignore
  }

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      chart_type TEXT NOT NULL DEFAULT 'auto',
      format TEXT NOT NULL DEFAULT 'excalidraw',
      config_name TEXT,
      config_model TEXT,
      current_code TEXT DEFAULT '',
      message_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL DEFAULT '',
      image_data TEXT,
      image_mime_type TEXT,
      source_type TEXT DEFAULT 'text',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)`);
  dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)`);

  // Migrate existing history records to conversations
  const migrated = dbInstance.exec("SELECT value FROM meta WHERE key = 'conversations_migrated'");
  if (migrated.length === 0 || migrated[0].values.length === 0) {
    const histories = dbInstance.exec('SELECT id, chart_type, user_input, generated_code, config_name, config_model, timestamp, format FROM history ORDER BY timestamp ASC');
    if (histories.length > 0) {
      for (const row of histories[0].values) {
        const histId = row[0] as string;
        const chartType = row[1] as string;
        const userInput = row[2] as string;
        const generatedCode = row[3] as string;
        const configName = row[4] as string | null;
        const configModel = row[5] as string | null;
        const timestamp = row[6] as number;
        const format = (row[7] as string) || 'excalidraw';
        const convId = 'conv_' + histId;
        const title = userInput.length > 50 ? userInput.substring(0, 50) + '...' : userInput;
        dbInstance.run(
          'INSERT INTO conversations (id, title, chart_type, format, config_name, config_model, current_code, message_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?)',
          [convId, title, chartType, format, configName, configModel, generatedCode, timestamp, timestamp]
        );
        dbInstance.run(
          'INSERT INTO messages (id, conversation_id, role, content, source_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          ['msg_u_' + histId, convId, 'user', userInput, 'text', timestamp]
        );
        dbInstance.run(
          'INSERT INTO messages (id, conversation_id, role, content, source_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          ['msg_a_' + histId, convId, 'assistant', generatedCode, 'text', timestamp]
        );
      }
    }
    dbInstance.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('conversations_migrated', 'true')");
  }

  saveToDisk();

  return dbInstance;
}

export function saveToDisk(): void {
  if (!dbInstance) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = dbInstance.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}
