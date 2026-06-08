/**
 * Shared utility functions
 */

/** 生成唯一 ID（基于 crypto.randomUUID，无碰撞风险） */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 解析存储的图片数据（单图或多图 JSON 数组）
 * 统一处理 imageData + imageMimeType 的解析逻辑
 */
export function parseStoredImages(imageData?: string, imageMimeType?: string): { data: string; mimeType: string }[] {
  if (!imageData || !imageMimeType) return [];
  if (imageMimeType === 'application/json') {
    try {
      return JSON.parse(imageData) as { data: string; mimeType: string }[];
    } catch {
      return [{ data: imageData, mimeType: 'image/png' }];
    }
  }
  return [{ data: imageData, mimeType: imageMimeType }];
}
