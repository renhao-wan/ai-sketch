/**
 * Input Orchestrator — coordinates multi-file input processing.
 *
 * Responsibilities:
 * 1. resolve(file)    — route each file to the correct strategy
 * 2. validateAll()    — validate all files, collect errors
 * 3. processAll()     — process files in parallel
 * 4. merge()          — combine results into a single MessagePayload
 *
 * Usage:
 *   const orchestrator = new InputOrchestrator([imageStrategy, fileStrategy]);
 *   const result = await orchestrator.handleFiles(files, userPrompt, chartType);
 *   if (result.success) onSendMessage(result.payload.content, chartType, result.payload.sourceType);
 *   else showErrors(result.errors);
 */

import type { InputStrategy, ProcessedItem, MessagePayload, InputSourceType } from '@/types/input-strategy';

interface OrchestrationSuccess {
  success: true;
  payload: MessagePayload;
}

interface OrchestrationFailure {
  success: false;
  errors: { fileName: string; error: string }[];
}

type OrchestrationResult = OrchestrationSuccess | OrchestrationFailure;

export class InputOrchestrator {
  private strategies: InputStrategy[];

  constructor(strategies: InputStrategy[]) {
    this.strategies = strategies;
  }

  /**
   * Find the first strategy that can handle this file.
   * Returns null if no strategy matches.
   */
  resolve(file: File): InputStrategy | null {
    return this.strategies.find(s => s.canHandle(file)) || null;
  }

  /**
   * Validate all files. Returns errors if any file fails validation.
   */
  validateAll(files: File[]): { valid: true } | { valid: false; errors: { fileName: string; error: string }[] } {
    const errors: { fileName: string; error: string }[] = [];

    for (const file of files) {
      const strategy = this.resolve(file);
      if (!strategy) {
        errors.push({ fileName: file.name, error: '不支持的文件类型' });
        continue;
      }
      const result = strategy.validate(file);
      if (!result.valid) {
        errors.push({ fileName: file.name, error: result.error });
      }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
  }

  /**
   * Process all files in parallel using their respective strategies.
   * Assumes validation has already passed.
   */
  async processAll(files: File[]): Promise<ProcessedItem[]> {
    const promises = files.map(async (file) => {
      const strategy = this.resolve(file)!;
      const data = await strategy.process(file);
      return {
        sourceType: strategy.sourceType,
        data,
        fileName: file.name,
      };
    });
    return Promise.all(promises);
  }

  /**
   * Merge processed items into a single MessagePayload.
   *
   * Logic:
   * - If only text files → merge content into one text payload
   * - If only images → single image or mixed payload
   * - If mixed → mixed payload with combined text + all images
   */
  merge(items: ProcessedItem[], userPrompt: string, chartType: string): MessagePayload {
    if (items.length === 0) {
      return { type: 'text', content: userPrompt, sourceType: 'text' };
    }

    const textItems = items.filter(i => i.sourceType === 'file');
    const imageItems = items.filter(i => i.sourceType === 'image');

    // Build text portion: user prompt + all file contents
    const textParts: string[] = [];
    if (userPrompt.trim()) textParts.push(userPrompt.trim());
    for (const item of textItems) {
      textParts.push(item.data as string);
    }
    const combinedText = textParts.join('\n\n');

    // No images → text-only payload
    if (imageItems.length === 0) {
      return {
        type: 'text',
        content: combinedText,
        sourceType: textItems.length > 0 ? 'file' : 'text',
      };
    }

    // Has images → image payload (1 or more, same structure)
    return {
      type: 'image',
      content: {
        text: combinedText,
        images: imageItems.map(i => (i.data as { imageObject: unknown }).imageObject),
      },
      sourceType: 'image',
    };
  }

  /**
   * Full pipeline: validate → process → merge.
   * Returns the result ready to be sent.
   */
  async handleFiles(
    files: File[],
    userPrompt: string,
    chartType: string,
  ): Promise<OrchestrationResult> {
    const validation = this.validateAll(files);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    try {
      const items = await this.processAll(files);
      const payload = this.merge(items, userPrompt, chartType);
      return { success: true, payload };
    } catch (e) {
      return { success: false, errors: [{ fileName: '', error: (e as Error).message }] };
    }
  }
}
