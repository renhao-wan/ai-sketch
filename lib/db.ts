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
