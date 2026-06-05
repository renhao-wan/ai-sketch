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
/** 防抖写入定时器 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;

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
      temperature REAL DEFAULT 0.5,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 为已有数据库添加 temperature 列（如果不存在）
  try {
    db.run('ALTER TABLE llm_configs ADD COLUMN temperature REAL DEFAULT 0.5');
  } catch {
    // 列已存在，忽略错误
  }

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
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)`);

  // AI 响应缓存表
  db.run(`
    CREATE TABLE IF NOT EXISTS response_cache (
      id TEXT PRIMARY KEY,
      prompt_hash TEXT NOT NULL,
      format TEXT NOT NULL,
      chart_type TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      use_count INTEGER DEFAULT 1
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_response_cache_hash ON response_cache(prompt_hash, format, chart_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_response_cache_last_used ON response_cache(last_used_at DESC)`);

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
 * 请求延迟持久化（防抖模式）
 * 多次写入合并为一次，500ms 内只执行最后一次
 * 适用于所有常规业务写入，避免频繁 I/O 阻塞事件循环
 */
export function requestSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveToDisk();
  }, 500);
}

/**
 * 关闭数据库连接，释放 WASM 内存
 * 在 Electron 应用退出前调用
 */
export function closeDb(): void {
  if (!dbInstance) return;
  try {
    // 取消防抖定时器，立即持久化
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
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
