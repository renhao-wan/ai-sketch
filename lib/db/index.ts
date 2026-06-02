import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

// 动态获取数据库路径
function getDbPath(): string {
  // 优先使用环境变量（Electron 模式）
  if (process.env.AI_SKETCH_DB_PATH) {
    return process.env.AI_SKETCH_DB_PATH;
  }
  // 默认路径（Web 模式）
  return path.join(process.cwd(), 'data', 'ai-sketch.db');
}

const DB_PATH = getDbPath();

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
