import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { getDbPath } from './paths';

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

  // 注意: journal_mode = WAL 对 sql.js WASM 内存数据库无效（no-op），
  // 真正的持久化通过 db.export() + 原子写入完成。保留此行仅为兼容性。
  db.run('PRAGMA foreign_keys = ON');

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
      max_tokens INTEGER DEFAULT 16384,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)`);

  // AI 响应缓存表
  db.run(`
    CREATE TABLE IF NOT EXISTS response_cache (
      id TEXT PRIMARY KEY,
      config_name TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      response TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      use_count INTEGER DEFAULT 1
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_response_cache_last_used ON response_cache(last_used_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_response_cache_config ON response_cache(config_name, model)`);

  // Vision API 配置表
  db.run(`
    CREATE TABLE IF NOT EXISTS vision_config (
      id TEXT PRIMARY KEY DEFAULT 'default',
      api_type TEXT NOT NULL DEFAULT 'openai',
      base_url TEXT NOT NULL DEFAULT '',
      api_key TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // 标签表
  db.run(`
    CREATE TABLE IF NOT EXISTS conversation_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at INTEGER NOT NULL
    )
  `);
  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_tags_name ON conversation_tags(name)');
  } catch {
    console.warn('[DB] conversation_tags name 唯一索引创建失败（可能已有重复数据）');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS config_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at INTEGER NOT NULL
    )
  `);
  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_config_tags_name ON config_tags(name)');
  } catch {
    console.warn('[DB] config_tags name 唯一索引创建失败（可能已有重复数据）');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS conversation_tag_relations (
      conversation_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (conversation_id, tag_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES conversation_tags(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS config_tag_relations (
      config_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (config_id, tag_id),
      FOREIGN KEY (config_id) REFERENCES llm_configs(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES config_tags(id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_conversation_tag_relations_tag ON conversation_tag_relations(tag_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_config_tag_relations_tag ON config_tag_relations(tag_id)');

  // 持久化数据库（新建或有表结构变更时）
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[DB] 初始持久化失败:', e);
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
 * 将内存数据库持久化到磁盘（原子写入）
 * 使用 write-to-temp-then-rename 模式确保写入的原子性：
 * - 先写入临时文件，再通过 rename 覆盖目标文件
 * - rename 在大多数文件系统上是原子操作，避免写入过程中崩溃导致数据库损坏
 * 目录检查使用同步 I/O（性能影响可忽略），数据写入使用异步 I/O 避免阻塞事件循环
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
    const tmpPath = DB_PATH + '.tmp';
    // 使用异步写入避免阻塞事件循环，通过 rename 保证原子性
    fs.promises.writeFile(tmpPath, Buffer.from(data))
      .then(() => fs.promises.rename(tmpPath, DB_PATH))
      .then(() => {
        isDirty = false;
      })
      .catch((e) => {
        isDirty = true;
        console.error('[DB] 持久化失败，数据将在下次成功写入时保存:', e);
        // 清理可能残留的临时文件
        fs.promises.unlink(tmpPath).catch(() => {});
      });
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
  isDirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveToDisk();
  }, 500);
}

/**
 * 将内存数据库同步持久化到磁盘（仅在应用退出时使用）
 * 使用 write-to-temp-then-rename 原子写入模式
 * 注意: 使用同步 I/O 阻塞事件循环，仅在 Electron app.quit 流程中调用
 */
export function saveToDiskSync(): void {
  if (!dbInstance) return;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = dbInstance.export();
    const tmpPath = DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, Buffer.from(data));
    fs.renameSync(tmpPath, DB_PATH);
    isDirty = false;
  } catch (e) {
    isDirty = true;
    console.error('[DB] 同步持久化失败:', e);
    // 清理可能残留的临时文件
    try { fs.unlinkSync(DB_PATH + '.tmp'); } catch { /* ignore */ }
  }
}

/**
 * 关闭数据库连接，释放 WASM 内存
 * 在 Electron 应用退出前调用，使用同步写入确保数据不丢失
 */
export function closeDb(): void {
  if (!dbInstance) return;
  try {
    // 取消防抖定时器，立即同步持久化
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveToDiskSync();
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
