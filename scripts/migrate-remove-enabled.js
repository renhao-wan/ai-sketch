/**
 * 迁移脚本：删除 custom_actions 表中的 enabled 字段
 * 使用方法：node scripts/migrate-remove-enabled.js
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'data', 'ai-sketch.db');
const SQL_PATH = path.join(__dirname, 'remove-enabled-field.sql');

async function migrate() {
  console.log('开始迁移：删除 enabled 字段...');

  // 检查数据库文件是否存在
  if (!fs.existsSync(DB_PATH)) {
    console.log('数据库文件不存在，跳过迁移');
    return;
  }

  try {
    // 初始化 SQL.js
    const SQL = await initSqlJs();

    // 读取数据库
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    // 检查 enabled 字段是否存在
    const tableInfo = db.exec("PRAGMA table_info(custom_actions)");
    const hasEnabled = tableInfo[0]?.values.some(row => row[1] === 'enabled');

    if (!hasEnabled) {
      console.log('enabled 字段不存在，跳过迁移');
      db.close();
      return;
    }

    // 读取并执行 SQL 脚本
    const sql = fs.readFileSync(SQL_PATH, 'utf-8');
    const statements = sql.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        db.run(statement);
      }
    }

    // 保存数据库
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));

    console.log('迁移完成：已删除 enabled 字段');
    db.close();
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

migrate();
