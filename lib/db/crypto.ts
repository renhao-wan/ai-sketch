/**
 * API Key 加密/解密工具
 * 使用 AES-256-GCM 加密，密钥存储在数据库同目录的 .key 文件中
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getKeyPath } from './paths';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/** 获取或创建加密密钥 */
function getOrCreateKey(): Buffer {
  const keyPath = getKeyPath();

  if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath);
    // 校验密钥文件长度，防止文件损坏或被截断
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `[Crypto] 密钥文件长度异常: 期望 ${KEY_LENGTH} 字节，实际 ${key.length} 字节。` +
        `请删除密钥文件 ${keyPath} 后重新启动应用以生成新密钥。`
      );
    }
    return key;
  }

  // 首次运行，生成随机密钥
  const dir = path.dirname(keyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const key = crypto.randomBytes(KEY_LENGTH);
  // 注意: mode 0o600 在 Windows 上无效（Windows 使用 ACL 权限管理）。
  // Windows 用户应确保数据目录的 NTFS 权限正确配置。
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
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
    throw new Error('加密格式无效');
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

/**
 * 判断字符串是否已加密（格式: iv:authTag:ciphertext，均为 hex）
 * 严格校验 IV（16 字节 = 32 hex 字符）和 AuthTag（16 字节 = 32 hex 字符）的长度，
 * 避免误判合法的 API Key（如某些网关 key 恰好符合 hex:hex:hex 格式）
 */
export function isEncrypted(value: string): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // IV: 16 bytes = 32 hex chars; AuthTag: 16 bytes = 32 hex chars; Ciphertext: 至少 1 个 hex 字符
  return /^[0-9a-f]{32}$/i.test(parts[0]) &&
         /^[0-9a-f]{32}$/i.test(parts[1]) &&
         /^[0-9a-f]+$/i.test(parts[2]) && parts[2].length > 0;
}
