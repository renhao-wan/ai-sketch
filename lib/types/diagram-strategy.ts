/**
 * Diagram Strategy Pattern — Java-interface-like abstraction
 * Each diagram format (Excalidraw, Mermaid, Draw.io) implements this interface.
 */

/** Supported diagram output formats */
export type DiagramFormat = 'excalidraw' | 'mermaid' | 'drawio';

/** Monaco Editor language modes for syntax highlighting */
export type CodeLanguage = 'json' | 'markdown' | 'xml';

/**
 * Strategy interface — the contract every diagram format must fulfill.
 * Covers the full lifecycle: prompt generation, post-processing, validation, rendering, export.
 */
export interface DiagramStrategy {
  /** Unique format key */
  readonly format: DiagramFormat;

  /** Human-readable display name (e.g. "Excalidraw", "Mermaid") */
  readonly displayName: string;

  /** Monaco Editor language mode for syntax highlighting */
  readonly codeLanguage: CodeLanguage;

  /** File extension for export (e.g. "json", "mmd", "drawio") */
  readonly fileExtension: string;

  /** MIME type for export blob */
  readonly mimeType: string;

  // ── Server-side (called in /api/generate) ──

  /** Return the system prompt for the LLM */
  getSystemPrompt(): string;

  /** Return the user prompt for the LLM */
  getUserPrompt(userInput: string, chartType: string): string;

  // ── Client-side (called in editor/page.tsx) ──

  /** Post-process raw LLM output into clean, renderable code */
  postProcess(rawCode: string): string;

  /** Optimize/transform the post-processed code (e.g. arrow alignment for Excalidraw) */
  optimize(code: string): string;

  /** Validate whether the code is renderable */
  validate(code: string): ValidationResult;

  /** Create a Blob for file download/export */
  createExportBlob(code: string): Blob;

  // ── Image prompt ──

  /** Generate a format-specific prompt for image-to-diagram conversion */
  generateImagePrompt(chartType: string): string;
}

/** Validation result discriminated union */
export type ValidationResult =
  | { valid: true; data: unknown }
  | { valid: false; error: string };
