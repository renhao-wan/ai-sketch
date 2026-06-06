import { Database } from 'sql.js';
/**
 * 获取数据库实例（单例，带并发锁）
 * 多个 async 请求同时调用时，只会初始化一次。
 */
export declare function getDb(): Promise<Database>;
/**
 * 将内存数据库持久化到磁盘
 * 写入失败时标记 isDirty 以便后续重试，不抛出异常以避免阻塞业务
 */
export declare function saveToDisk(): void;
/**
 * 请求延迟持久化（防抖模式）
 * 多次写入合并为一次，500ms 内只执行最后一次
 * 适用于所有常规业务写入，避免频繁 I/O 阻塞事件循环
 */
export declare function requestSave(): void;
/**
 * 关闭数据库连接，释放 WASM 内存
 * 在 Electron 应用退出前调用
 */
export declare function closeDb(): void;
/**
 * 检查是否有未持久化的数据
 */
export declare function hasUnsavedChanges(): boolean;
//# sourceMappingURL=index.d.ts.map