/**
 * API Key 加密/解密工具
 * 使用 AES-256-GCM 加密，密钥存储在数据库同目录的 .key 文件中
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/** 获取或创建加密密钥 */
function getOrCreateKey(): Buffer {
  // 从 DB_PATH 推导密钥文件路径
  const dbPath = getDbPath();
  const keyPath = dbPath + '.key';

  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath);
  }

  // 首次运行，生成随机密钥
  const dir = path.dirname(keyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const key = crypto.randomBytes(KEY_LENGTH);
  fs.writeFileSync(keyPath, key, { mode: 0o600 }); // 仅 owner 可读写
  return key;
}

/** 获取数据库路径（复用 index.ts 的逻辑） */
function getDbPath(): string {
  if (process.env.AI_SKETCH_DB_PATH) {
    return process.env.AI_SKETCH_DB_PATH;
  }
  return path.join(process.cwd(), 'data', 'ai-sketch.db');
}

/** 加密明文，返回格式: iv:authTag:ciphertext（均为 hex） */
export function encrypt(plaintext: string): string {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/** 解密密文，输入格式: iv:authTag:ciphertext（均为 hex） */
export function decrypt(ciphertext: string): string {
  const key = getOrCreateKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** 判断字符串是否已加密（格式: hex:hex:hex） */
export function isEncrypted(value: string): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  return parts.every(p => /^[0-9a-f]+$/i.test(p) && p.length > 0);
}
