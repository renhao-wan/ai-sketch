/**
 * Image input strategy — validates image files, converts to base64, builds image message.
 */

import type { InputStrategy, InputValidationResult, MessagePayload } from '@/types/input-strategy';
import { validateImage, createImageObject, getImagePreviewUrl, SUPPORTED_IMAGE_TYPES } from '@/lib/image-utils';
import { getStrategy } from '@/lib/strategies/registry';
import type { DiagramFormat } from '@/types/diagram-strategy';

export interface ImageProcessedData {
  imageObject: unknown;
  previewUrl: string;
}

class ImageStrategy implements InputStrategy {
  readonly sourceType = 'image' as const;
  private diagramFormat: DiagramFormat = 'excalidraw';

  setDiagramFormat(format: DiagramFormat) {
    this.diagramFormat = format;
  }

  canHandle(file: File): boolean {
    return Object.keys(SUPPORTED_IMAGE_TYPES).includes(file.type);
  }

  validate(input: unknown): InputValidationResult {
    const file = input as File;
    if (!file?.name) return { valid: false, error: '无效的图片文件' };
    return validateImage(file);
  }

  async process(input: unknown): Promise<ImageProcessedData> {
    const file = input as File;
    const [imageObject, previewUrl] = await Promise.all([
      createImageObject(file),
      getImagePreviewUrl(file),
    ]);
    return { imageObject, previewUrl };
  }

  buildMessage(processedData: unknown, userPrompt: string, chartType: string): MessagePayload {
    const { imageObject } = processedData as ImageProcessedData;
    const text = userPrompt.trim() || getStrategy(this.diagramFormat).generateImagePrompt(chartType);
    return {
      type: 'image',
      content: { text, images: [imageObject] },
      sourceType: 'image',
    };
  }
}

export const imageStrategy: ImageStrategy = new ImageStrategy();
