/**
 * Shared utility functions
 */

/** Generate a short unique ID (base36 timestamp + random) */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
