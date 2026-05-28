/**
 * 图片处理工具函数
 * 支持客户端图片验证、base64转换和元数据提取
 */

import type { ImageValidationResult, ImageObject } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';
import { getStrategy } from '@/lib/strategies/registry';

// 支持的图片格式
export const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// 最大文件大小 (5MB)
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * 验证图片文件
 */
export function validateImage(file: File): ImageValidationResult {
  // 检查文件类型
  if (!Object.keys(SUPPORTED_IMAGE_TYPES).includes(file.type)) {
    return {
      isValid: false,
      error: `不支持的图片格式。支持的格式：${Object.values(SUPPORTED_IMAGE_TYPES).join(', ')}`,
    };
  }

  // 检查文件大小
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      isValid: false,
      error: `图片大小不能超过 ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB`,
    };
  }

  return { isValid: true };
}

/**
 * 将图片文件转换为base64
 */
export function convertToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      // 移除data:image/xxx;base64,前缀，只返回base64数据
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };

    reader.onerror = () => {
      reject(new Error('图片读取失败'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 获取图片的base64 URL（用于预览）
 */
export function getImagePreviewUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(new Error('图片预览失败'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 获取图片尺寸信息
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const dimensions = {
        width: img.width,
        height: img.height,
      };
      URL.revokeObjectURL(url);
      resolve(dimensions);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片尺寸'));
    };

    img.src = url;
  });
}

/**
 * 格式化文件大小显示
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 获取文件的扩展名
 */
export function getFileExtension(file: File): string {
  return SUPPORTED_IMAGE_TYPES[file.type] || 'unknown';
}

/**
 * 创建图片对象用于API调用
 */
export async function createImageObject(file: File): Promise<ImageObject> {
  const validation = validateImage(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  try {
    const [base64Data, dimensions] = await Promise.all([
      convertToBase64(file),
      getImageDimensions(file),
    ]);

    return {
      data: base64Data,
      mimeType: file.type,
      dimensions,
      size: file.size,
      name: file.name,
    };
  } catch (error) {
    throw new Error(`图片处理失败: ${(error as Error).message}`);
  }
}

/**
 * 生成图片描述提示词（格式感知）
 */
export function generateImagePrompt(chartType: string, diagramFormat: DiagramFormat = 'excalidraw'): string {
  const strategy = getStrategy(diagramFormat);
  return strategy.generateImagePrompt(chartType);
}
