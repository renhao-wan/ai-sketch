/** LLM provider configuration */
export interface LLMConfig {
  id?: string;
  name: string;
  type: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
  description?: string;
  isActive?: boolean;
  /** 生成温度，控制输出随机性，范围 0-2，默认 0.5 */
  temperature?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** LLM chat message */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: ImageData[];
}

/** Base64 image data */
export interface ImageData {
  data: string;
  mimeType: string;
}

/** Notification component state */
export interface NotificationState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

/** Confirm dialog component state */
export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
}

/** Connection test result */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  models?: ModelInfo[];
}

/** Model info from provider API */
export interface ModelInfo {
  id: string;
  name: string;
}

/** AI action IDs */
export type AIActionId = 'layout' | 'beautify' | 'simplify' | 'explain';

/** Input source type */
export type SourceType = 'text' | 'file' | 'image';

/** Simplified Excalidraw element */
export interface ExcalidrawElement {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  id?: string;
  start?: { id: string };
  end?: { id: string };
  [key: string]: unknown;
}


/** Image object for API calls — extends ImageData with additional metadata */
export interface ImageObject extends ImageData {
  dimensions: { width: number; height: number };
  size: number;
  name: string;
}

/** Generate API request body */
export interface GenerateRequest {
  config: LLMConfig;
  userInput: string | { text?: string; image?: ImageData; images?: ImageData[] };
  chartType: string;
  format?: import('./diagram-strategy').DiagramFormat;
}

/** Conversation metadata */
export interface Conversation {
  id: string;
  title: string;
  chartType: string;
  format: import('./diagram-strategy').DiagramFormat;
  configName?: string;
  configModel?: string;
  currentCode: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Single message within a conversation */
export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  imageData?: string;
  imageMimeType?: string;
  sourceType?: SourceType;
  createdAt: number;
}

/** Conversation with its messages loaded */
export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}
