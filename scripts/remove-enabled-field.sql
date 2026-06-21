-- 迁移脚本：删除 custom_actions 表中的 enabled 字段
-- 使用方法：sqlite3 data/ai-sketch.db < scripts/remove-enabled-field.sql

-- SQLite 不支持直接删除列，需要重建表
-- 1. 创建新表（不含 enabled 字段）
CREATE TABLE IF NOT EXISTS custom_actions_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  icon TEXT DEFAULT 'Zap',
  action_type TEXT DEFAULT 'modify',
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. 复制数据（跳过 enabled 字段）
INSERT INTO custom_actions_new (id, name, prompt, icon, action_type, sort_order, created_at, updated_at)
SELECT id, name, prompt, icon, action_type, sort_order, created_at, updated_at
FROM custom_actions;

-- 3. 删除旧表
DROP TABLE custom_actions;

-- 4. 重命名新表
ALTER TABLE custom_actions_new RENAME TO custom_actions;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_custom_actions_sort ON custom_actions(sort_order);
