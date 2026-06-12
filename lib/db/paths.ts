/**
 * 数据库路径管理
 * 统一提供数据库路径和密钥文件路径，避免各模块重复推导
 */

import path from 'path';

/** 获取数据库文件路径 */
export function getDbPath(): string {
  if (process.env.AI_SKETCH_DB_PATH) {
    return process.env.AI_SKETCH_DB_PATH;
  }
  return path.join(process.cwd(), 'data', 'ai-sketch.db');
}

/** 获取加密密钥文件路径（数据库路径 + .key 后缀） */
export function getKeyPath(): string {
  return getDbPath() + '.key';
}
