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
/** 防止 getDb() 并发初始化的 Promise 锁 */
let dbPromise: Promise<Database> | null = null;
/** 标记数据库是否有未持久化的写入 */
let isDirty = false;

async function initDb(): Promise<Database> {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();
  let db: Database;
  let isNew = false;

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    isNew = true;
  }

  db.run('PRAGMA journal_mode = WAL');

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
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

  db.run(`
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

  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)`);

  // 仅在新建数据库时持久化，已有文件无需重复写盘
  if (isNew) {
    try {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
      console.error('[DB] 初始持久化失败:', e);
    }
  }

  return db;
}

/**
 * 获取数据库实例（单例，带并发锁）
 * 多个 async 请求同时调用时，只会初始化一次。
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!dbPromise) {
    dbPromise = initDb().then(db => {
      dbInstance = db;
      return db;
    }).catch(e => {
      // 初始化失败时重置，允许后续重试
      dbInstance = null;
      throw e;
    }).finally(() => {
      dbPromise = null;
    });
  }

  return dbPromise;
}

/**
 * 将内存数据库持久化到磁盘
 * 写入失败时标记 isDirty 以便后续重试，不抛出异常以避免阻塞业务
 */
export function saveToDisk(): void {
  if (!dbInstance) return;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = dbInstance.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    isDirty = false;
  } catch (e) {
    isDirty = true;
    console.error('[DB] 持久化失败，数据将在下次成功写入时保存:', e);
  }
}

/**
 * 关闭数据库连接，释放 WASM 内存
 * 在 Electron 应用退出前调用
 */
export function closeDb(): void {
  if (!dbInstance) return;
  try {
    // 最后一次持久化
    saveToDisk();
    dbInstance.close();
  } catch (e) {
    console.error('[DB] 关闭数据库时出错:', e);
  } finally {
    dbInstance = null;
  }
}

/**
 * 检查是否有未持久化的数据
 */
export function hasUnsavedChanges(): boolean {
  return isDirty;
}
