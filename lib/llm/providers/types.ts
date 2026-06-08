/**
 * LLM Provider 接口定义
 * 将每种 provider 的差异封装到独立实现中
 */

import type { LLMMessage, ModelInfo } from '@/lib/types';

/** SSE 流处理选项 */
export interface SSEExtractors {
  /** 从 SSE JSON 中提取内容 */
  extractContent: (json: Record<string, unknown>) => string | undefined;
  /** 检查是否应该停止（返回错误消息，undefined 表示继续） */
  checkStop?: (json: Record<string, unknown>) => string | undefined;
  /** 跳过特定行 */
  skipLine?: (trimmed: string) => boolean;
}

/** LLM Provider 接口 */
export interface LLMProvider {
  /** Provider 类型标识 */
  readonly type: string;

  /**
   * 构建请求头
   * @param apiKey API 密钥
   */
  buildRequestHeaders(apiKey: string): Record<string, string>;

  /**
   * 构建请求体
   * @param model 模型名称
   * @param messages 消息列表
   * @param temperature 温度参数，控制输出随机性
   * @param maxTokens 最大输出 token 数
   */
  buildRequestBody(model: string, messages: LLMMessage[], temperature?: number, maxTokens?: number): object;

  /**
   * 获取 API 端点路径
   * @param baseUrl 基础 URL
   */
  getEndpoint(baseUrl: string): string;

  /**
   * 获取 SSE 提取器
   */
  getSSEExtractors(): SSEExtractors;

  /**
   * 处理消息（转换为 provider 特定格式）
   * @param message 原始消息
   */
  processMessage(message: LLMMessage): unknown;

  /**
   * 获取模型列表的请求头
   * @param apiKey API 密钥
   */
  buildModelsRequestHeaders(apiKey: string): Record<string, string>;

  /**
   * 获取模型列表的端点
   * @param baseUrl 基础 URL
   */
  getModelsEndpoint(baseUrl: string): string;
}
