/**
 * API 路由错误处理装饰器
 * 统一处理 try/catch 错误响应，减少重复代码
 */

import { NextResponse } from 'next/server';

/**
 * 包装 API 路由处理函数，自动捕获错误并返回统一的错误响应
 *
 * @param handler 原始路由处理函数
 * @param context 错误日志上下文（如路由路径）
 * @returns 包装后的处理函数
 *
 * @example
 * export const POST = withErrorHandling(async (req) => {
 *   const data = await req.json();
 *   // ... 业务逻辑，无需 try/catch
 *   return NextResponse.json(result);
 * }, '/api/configs');
 */
export function withErrorHandling<T extends (...args: never[]) => Promise<Response>>(
  handler: T,
  context?: string,
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      const prefix = context ? `[API] ${context}` : '[API]';
      console.error(`${prefix} Error:`, error);

      const message = process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : '请求处理失败，请稍后重试';

      return NextResponse.json({ error: message }, { status: 500 });
    }
  }) as T;
}
