/**
 * Input Strategy Pattern — handles text/file/image input validation and message construction.
 * Each input type implements this interface, isolating its specific logic.
 */

/** The type of input source — alias of SourceType from types/index.ts */
export type InputSourceType = 'text' | 'file' | 'image';

// Note: SourceType in types/index.ts has the same definition.
// Both are kept for backward compatibility but should be unified.

/** Validation result */
export type InputValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/** A single processed file/image result from a strategy */
export interface ProcessedItem {
  sourceType: InputSourceType;
  data: unknown;
  fileName: string;
}

/** Normalized message payload ready to be sent to onSendMessage */
export type MessagePayload =
  | { type: 'text'; content: string; sourceType: InputSourceType }
  | { type: 'image'; content: { text: string; images: unknown[] }; sourceType: 'image' };

/**
 * Strategy interface for input handling.
 * Each input type (text, file, image) implements this.
 */
export interface InputStrategy {
  /** Unique source type key */
  readonly sourceType: InputSourceType;

  /** Whether this strategy can handle the given file (by MIME type, extension, etc.) */
  canHandle(file: File): boolean;

  /** Validate a raw input (File object or string). Returns validation result. */
  validate(input: unknown): InputValidationResult;

  /**
   * Process the input asynchronously (e.g. read file content, convert image to base64).
   * Returns the processed data that will be used by buildMessage.
   */
  process(input: unknown): Promise<unknown>;

  /**
   * Build a normalized message payload from the processed data and optional user prompt.
   * The payload is ready to be passed to onSendMessage.
   */
  buildMessage(processedData: unknown, userPrompt: string, chartType: string): MessagePayload;
}
