/**
 * 数据库行校验工具
 * 提供运行时类型校验，防止数据损坏导致的静默错误
 */

/** 校验值是否为指定类型，失败时抛出明确错误 */
export function assertType(value: unknown, type: 'string' | 'number' | 'boolean', fieldName: string): void {
  if (typeof value !== type) {
    throw new Error(`[DB] 字段 ${fieldName} 类型异常: 期望 ${type}，实际 ${typeof value}`);
  }
}

/** 安全获取字符串值，失败时返回默认值 */
export function safeString(value: unknown, fieldName: string, defaultValue = ''): string {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value !== 'string') {
    console.warn(`[DB] 字段 ${fieldName} 类型异常: 期望 string，实际 ${typeof value}，使用默认值`);
    return defaultValue;
  }
  return value;
}

/** 安全获取数字值，失败时返回默认值 */
export function safeNumber(value: unknown, fieldName: string, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value !== 'number' || !isFinite(value)) {
    console.warn(`[DB] 字段 ${fieldName} 类型异常: 期望 number，实际 ${typeof value}，使用默认值`);
    return defaultValue;
  }
  return value;
}

/** 安全获取布尔值（数据库中存储为 0/1） */
export function safeBoolean(value: unknown, fieldName: string, defaultValue = false): boolean {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'boolean') return value;
  console.warn(`[DB] 字段 ${fieldName} 类型异常: 期望 number/boolean，实际 ${typeof value}，使用默认值`);
  return defaultValue;
}

/** 安全获取可选字符串值（null/undefined 都返回 undefined） */
export function safeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') {
    console.warn(`[DB] 字段 ${fieldName} 类型异常: 期望 string，实际 ${typeof value}，返回 undefined`);
    return undefined;
  }
  return value;
}
