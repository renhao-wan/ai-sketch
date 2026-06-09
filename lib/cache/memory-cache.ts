/**
 * L1 内存缓存 — 基于 Map 的 LRU 缓存
 * 泛型设计，可复用于任何需要内存缓存的场景
 */

interface CacheEntry<T> {
  value: T;
  size: number;
}

export class MemoryCache<T = string> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly maxSizeBytes: number;

  /**
   * @param maxEntries 最大条目数（默认 50）
   * @param maxSizeBytes 最大体积（字节，默认 1MB）
   */
  constructor(maxEntries = 50, maxSizeBytes = 1024 * 1024) {
    this.maxEntries = maxEntries;
    this.maxSizeBytes = maxSizeBytes;
  }

  /** 获取缓存值，命中时移到末尾（LRU） */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    // 移到末尾（Map 的迭代顺序即插入顺序）
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /** 设置缓存值，超限时淘汰最旧条目 */
  set(key: string, value: T, size?: number): void {
    // 如果已存在，先删除旧的
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    const entrySize = size ?? this.estimateSize(value);

    // 淘汰直到有空间
    while (this.cache.size >= this.maxEntries || this.totalSize() + entrySize > this.maxSizeBytes) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }

    this.cache.set(key, { value, size: entrySize });
  }

  /** 删除缓存条目 */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /** 检查是否包含指定 key */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** 清空所有缓存 */
  clear(): void {
    this.cache.clear();
  }

  /** 当前条目数 */
  get size(): number {
    return this.cache.size;
  }

  /** 估算值的体积（字节） */
  private estimateSize(value: T): number {
    if (typeof value === 'string') {
      // 字符串：每个字符约 2 字节（JS 使用 UTF-16）
      return value.length * 2;
    }
    // 其他类型：JSON 序列化后估算
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 100; // 保底估算
    }
  }

  /** 计算当前总占用体积 */
  private totalSize(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }
}
