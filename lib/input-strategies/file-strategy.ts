/**
 * File input strategy — validates .md/.txt files, reads content, combines with user prompt.
 */

import type { InputStrategy, InputValidationResult, MessagePayload } from '@/lib/types/input-strategy';

const ALLOWED_EXTENSIONS = ['.md', '.txt'];
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

class FileStrategy implements InputStrategy {
  readonly sourceType = 'file' as const;

  canHandle(file: File): boolean {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  }

  validate(input: unknown): InputValidationResult {
    const file = input as File;
    if (!file?.name) return { valid: false, error: '无效的文件' };

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { valid: false, error: '请选择 .md 或 .txt 文件' };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: '文件大小不能超过 1MB' };
    }
    return { valid: true };
  }

  async process(input: unknown): Promise<string> {
    const file = input as File;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = ((reader.result as string) || '').trim();
        if (content) resolve(content);
        else reject(new Error('文件内容为空'));
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  buildMessage(processedData: unknown, userPrompt: string, _chartType: string, _diagramFormat?: unknown): MessagePayload {
    const fileContent = processedData as string;
    const combined = userPrompt.trim()
      ? `用户指令：\n${userPrompt.trim()}\n\n参考内容：\n${fileContent}`
      : fileContent;
    return {
      type: 'text',
      content: combined,
      sourceType: 'file',
    };
  }
}

export const fileStrategy: InputStrategy = new FileStrategy();
