/**
 * 一次性脚本：清空 conversations/messages 表，从 history 重新迁移最新 15 条记录
 * 运行后自动删除此脚本
 *
 * 用法: npx tsx scripts/reset-conversations.ts
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'ai-sketch.db');

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('数据库文件不存在:', DB_PATH);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  console.log('── 开始重置 conversations 数据 ──');

  // 1. 确保表存在
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

  // 2. 清空 conversations 和 messages
  db.run('DELETE FROM messages');
  db.run('DELETE FROM conversations');
  console.log('✓ 已清空 conversations 和 messages 表');

  // 3. 读取最新 15 条 history
  const result = db.exec(
    'SELECT id, chart_type, user_input, generated_code, config_name, config_model, timestamp, format FROM history ORDER BY timestamp DESC LIMIT 15'
  );

  if (result.length === 0 || result[0].values.length === 0) {
    console.log('⚠ history 表无数据，跳过迁移');
  } else {
    const rows = result[0].values;
    console.log(`✓ 找到 ${rows.length} 条 history 记录，开始迁移...`);

    for (const row of rows) {
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

      db.run(
        'INSERT INTO conversations (id, title, chart_type, format, config_name, config_model, current_code, message_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?)',
        [convId, title, chartType, format, configName, configModel, generatedCode, timestamp, timestamp]
      );
      db.run(
        'INSERT INTO messages (id, conversation_id, role, content, source_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['msg_u_' + histId, convId, 'user', userInput, 'text', timestamp]
      );
      db.run(
        'INSERT INTO messages (id, conversation_id, role, content, source_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['msg_a_' + histId, convId, 'assistant', generatedCode, 'text', timestamp]
      );
    }
    console.log(`✓ 已迁移 ${rows.length} 条记录为 conversations`);
  }

  // 3. 重置迁移标记
  db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('conversations_migrated', 'true')");

  // 4. 保存到磁盘
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('✓ 数据库已保存');

  db.close();

  // 5. 自删除脚本
  const scriptPath = path.resolve(__filename);
  if (fs.existsSync(scriptPath)) {
    fs.unlinkSync(scriptPath);
    console.log('✓ 脚本已自删除');
  }

  // 清理 scripts 目录（如果为空）
  const scriptsDir = path.dirname(scriptPath);
  if (fs.existsSync(scriptsDir) && fs.readdirSync(scriptsDir).length === 0) {
    fs.rmdirSync(scriptsDir);
    console.log('✓ scripts 目录已清理');
  }

  console.log('── 重置完成 ──');
}

main().catch((err) => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
