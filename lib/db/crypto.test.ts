import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 使用临时目录避免影响项目数据
let tempDir: string;
let originalEnv: string | undefined;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-test-'));
  originalEnv = process.env.AI_SKETCH_DB_PATH;
  process.env.AI_SKETCH_DB_PATH = path.join(tempDir, 'test.db');
});

afterAll(() => {
  if (originalEnv !== undefined) {
    process.env.AI_SKETCH_DB_PATH = originalEnv;
  } else {
    delete process.env.AI_SKETCH_DB_PATH;
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// 动态导入以使用设置后的环境变量
const { encrypt, decrypt, isEncrypted } = await import('./crypto');

describe('isEncrypted', () => {
  // IV: 16 bytes = 32 hex chars; AuthTag: 16 bytes = 32 hex chars
  const validIV = 'a'.repeat(32);
  const validAuthTag = 'b'.repeat(32);
  const validCiphertext = 'cdef0123456789ab';

  it('应识别有效的加密格式', () => {
    // IV 和 AuthTag 各 32 个 hex 字符（16 字节），ciphertext 至少 1 个 hex 字符
    expect(isEncrypted(`${validIV}:${validAuthTag}:${validCiphertext}`)).toBe(true);
    expect(isEncrypted('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1:7890ab')).toBe(true);
  });

  it('应拒绝 IV 或 AuthTag 长度不正确的字符串', () => {
    // IV 只有 6 个字符（应为 32）
    expect(isEncrypted('abc123:def4567890abcdef4567890abcdef4567:789abc')).toBe(false);
    // AuthTag 只有 6 个字符（应为 32）
    expect(isEncrypted(`${validIV}:def456:789abc`)).toBe(false);
    // IV 和 AuthTag 都太短
    expect(isEncrypted('abc123:def456:789abc')).toBe(false);
  });

  it('应拒绝非加密格式', () => {
    expect(isEncrypted('plain text')).toBe(false);
    expect(isEncrypted('sk-abc123')).toBe(false);
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted('ab:cd')).toBe(false); // 只有两段
    expect(isEncrypted('ab:cd:ef:gh')).toBe(false); // 四段
  });

  it('应拒绝含非 hex 字符的字符串', () => {
    expect(isEncrypted(`xyz${'a'.repeat(29)}:${validAuthTag}:${validCiphertext}`)).toBe(false);
    expect(isEncrypted(`${validIV}:de ghi${'a'.repeat(26)}:${validCiphertext}`)).toBe(false);
  });

  it('应拒绝空段', () => {
    expect(isEncrypted(`${validIV}::${validCiphertext}`)).toBe(false);
    expect(isEncrypted(`:${validAuthTag}:${validCiphertext}`)).toBe(false);
  });

  it('应拒绝非字符串输入', () => {
    expect(isEncrypted(null as unknown as string)).toBe(false);
    expect(isEncrypted(undefined as unknown as string)).toBe(false);
    expect(isEncrypted(123 as unknown as string)).toBe(false);
  });
});

describe('encrypt / decrypt', () => {
  it('应能加密并解密还原', () => {
    const original = 'sk-test-api-key-12345';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('加密结果应为三段 hex 格式', () => {
    const encrypted = encrypt('hello');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    parts.forEach(part => {
      expect(/^[0-9a-f]+$/i.test(part)).toBe(true);
      expect(part.length).toBeGreaterThan(0);
    });
  });

  it('加密结果应通过 isEncrypted 检查', () => {
    const encrypted = encrypt('test-value');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('每次加密结果应不同（随机 IV）', () => {
    const a = encrypt('same-input');
    const b = encrypt('same-input');
    expect(a).not.toBe(b);
    // 但都能正确解密
    expect(decrypt(a)).toBe('same-input');
    expect(decrypt(b)).toBe('same-input');
  });

  it('应能处理空字符串', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('应能处理 Unicode 字符', () => {
    const original = '你好世界🔑';
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('应能处理长字符串', () => {
    const original = 'x'.repeat(10000);
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('解密无效格式应抛出错误', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted format');
    expect(() => decrypt('ab:cd')).toThrow('Invalid encrypted format');
  });

  it('篡改密文应导致解密失败', () => {
    const encrypted = encrypt('secret');
    const parts = encrypted.split(':');
    // 篡改密文部分
    parts[2] = parts[2].replace(/^./, '0');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
});
