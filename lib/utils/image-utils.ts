/**
 * 图片处理工具函数
 * 支持客户端图片验证、base64转换和元数据提取
 */

import type { ImageObject } from '@/lib/types';
import type { InputValidationResult } from '@/lib/types/input-strategy';

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
export function validateImage(file: File): InputValidationResult {
  if (!Object.keys(SUPPORTED_IMAGE_TYPES).includes(file.type)) {
    return { valid: false, error: `不支持的图片格式。支持的格式：${Object.values(SUPPORTED_IMAGE_TYPES).join(', ')}` };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `图片大小不能超过 ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB` };
  }
  return { valid: true };
}

/**
 * 获取图片的base64 URL（用于预览）
 */
export function getImagePreviewUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('图片预览失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 创建图片对象用于API调用
 */
export async function createImageObject(file: File): Promise<ImageObject> {
  const validation = validateImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

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
}

// ── Internal helpers (not exported) ──

function convertToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片尺寸'));
    };
    img.src = url;
  });
}
