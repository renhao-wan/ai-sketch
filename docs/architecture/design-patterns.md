# 设计模式

本文档记录 AI Sketch 项目中使用的设计模式，帮助开发者理解架构决策和代码组织方式。

---

## 目录

- [一、创建型模式](#一创建型模式)
- [二、结构型模式](#二结构型模式)
- [三、行为型模式](#三行为型模式)
- [四、React Hooks 模式](#四react-hooks-模式)
- [五、文件索引](#五文件索引)

---

## 一、创建型模式

### 1.1 单例模式（Singleton）

**用途**: 全局状态管理，确保单一实例

**实现**: 模块级实例 + 导出

```typescript
// lib/db/config-manager.ts
class ConfigManager {
  // ...
}

export const configManager = new ConfigManager();
```

**应用**:
- `configManager` — LLM 配置管理
- `conversationManager` — 会话管理
- `cacheManager` — 响应缓存管理
- `proxyManager` — 代理配置管理

**优点**:
- 全局唯一实例，避免状态不一致
- 延迟初始化，按需加载
- 简化调用方代码

---

### 1.2 工厂模式（Factory）

**用途**: 根据类型创建对应的策略实例

**实现**: 注册表 + 查找函数

```typescript
// lib/strategies/registry.ts
const strategies: Record<DiagramFormat, DiagramStrategy> = {
  excalidraw: new ExcalidrawStrategy(),
  mermaid: new MermaidStrategy(),
  drawio: new DrawioStrategy(),
};

export function getStrategy(format: DiagramFormat): DiagramStrategy {
  return strategies[format];
}
```

**应用**:
- `getStrategy(format)` — 获取图表策略
- `getProvider(type)` — 获取 LLM Provider
- `getInputStrategy(mimeType)` — 获取输入策略

**优点**:
- 解耦创建逻辑和使用逻辑
- 易于扩展新类型
- 集中管理实例

---

## 二、结构型模式

### 2.1 策略模式（Strategy）

**用途**: 定义可互换的算法族，使算法独立于使用它的客户端

**接口定义**:

```typescript
// lib/types/diagram-strategy.ts
export interface DiagramStrategy {
  readonly codeLanguage: string;
  readonly fileExtension: string;
  getSystemPrompt(): string;
  getUserPrompt(input: string, chartType: string): string;
  postProcess(code: string): string;
  optimize(code: string): string;
  validate(code: string): ValidationResult;
  createExportBlob(code: string): Blob;
}
```

**实现**:
- `ExcalidrawStrategy` — Excalidraw 图表
- `MermaidStrategy` — Mermaid 图表
- `DrawioStrategy` — Draw.io 图表

**应用**:
```typescript
const strategy = getStrategy(format);
const processed = strategy.postProcess(code);
const result = strategy.validate(processed);
```

**优点**:
- 符合开闭原则（OCP）
- 算法可独立变化
- 易于测试和替换

---

### 2.2 适配器模式（Adapter）

**用途**: 统一不同 LLM Provider 的接口差异

**接口定义**:

```typescript
// lib/llm/providers/types.ts
export interface LLMProvider {
  readonly type: string;
  buildRequestHeaders(apiKey: string): Record<string, string>;
  buildRequestBody(model: string, messages: LLMMessage[]): object;
  getEndpoint(baseUrl: string): string;
  getSSEExtractors(): SSEExtractors;
  processMessage(message: LLMMessage): unknown;
  buildModelsRequestHeaders(apiKey: string): Record<string, string>;
  getModelsEndpoint(baseUrl: string): string;
}
```

**实现**:
- `OpenAIProvider` — OpenAI 兼容 API
- `AnthropicProvider` — Anthropic API

**应用**:
```typescript
const provider = getProvider(config.type);
const headers = provider.buildRequestHeaders(config.apiKey);
const body = provider.buildRequestBody(config.model, messages);
```

**优点**:
- 统一接口，简化客户端代码
- 新增 Provider 只需实现接口
- 隔离 API 差异

---

### 2.3 装饰器模式（Decorator）

**用途**: 为函数添加额外功能，不修改原函数

**实现**:

```typescript
// lib/api/with-error-handling.ts
export function withErrorHandling<T extends (...args: never[]) => Promise<Response>>(
  handler: T,
  context?: string,
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      // 统一错误处理
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }) as T;
}
```

**应用**:
```typescript
export const GET = withErrorHandling(async (req) => {
  // 业务逻辑，无需 try/catch
  return NextResponse.json(data);
}, '/api/configs GET');
```

**优点**:
- 减少重复的 try/catch 代码
- 统一错误响应格式
- 保持函数签名不变

---

## 三、行为型模式

### 3.1 命令模式（Command）

**用途**: 将请求封装为对象，支持参数化和队列化

**实现**:

```typescript
// app/api/configs/actions/route.ts
type ActionHandler = (body: Record<string, unknown>) => Promise<unknown>;

const actionHandlers: Record<string, ActionHandler> = {
  'set-active': async (body) => {
    await configManager.setActiveConfig(body.configId as string);
    return { success: true };
  },
  'clone': async (body) => {
    return configManager.cloneConfig(body.configId as string, body.newName as string);
  },
  // ...
};

export async function POST(request: Request) {
  const { action } = await request.json();
  const handler = actionHandlers[action];
  return NextResponse.json(await handler(body));
}
```

**优点**:
- 易于扩展新命令
- 命令与调用者解耦
- 支持参数验证

---

### 3.2 模板方法模式（Template Method）

**用途**: 定义算法骨架，子步骤可变

**实现**:

```typescript
// lib/db/transaction.ts
export function withTransaction(db: Database, fn: () => void, persist = true): void {
  db.run('BEGIN');
  try {
    fn();                    // 可变的业务逻辑
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  if (persist) {
    saveToDisk();
  }
}
```

**应用**:
```typescript
withTransaction(db, () => {
  db.run('DELETE FROM messages WHERE conversation_id = ?', [id]);
  db.run('DELETE FROM conversations WHERE id = ?', [id]);
});
```

**优点**:
- 固定事务流程
- 业务逻辑可定制
- 自动处理提交/回滚

---

### 3.3 中介者模式（Mediator）

**用途**: 用一个中介对象封装一系列对象交互

**实现**: SSE 解析器作为中介

```typescript
// lib/api/sse-parser.ts
export async function parseSSEStream(options: SSEParserOptions): Promise<void> {
  const { body, signal, onLine } = options;
  // 统一的流解析逻辑
  // 通过 onLine 回调分发事件
}
```

**应用**:
- `consumeSSEStream` — 客户端 SSE 消费
- `processSSEStream` — 服务端 SSE 处理

**优点**:
- 解耦流解析和事件处理
- 统一的错误处理
- 复用解析逻辑

---

## 四、React Hooks 模式

### 4.1 自定义 Hook（Custom Hook）

**用途**: 提取可复用的状态逻辑

**实现**:

```typescript
// hooks/useConversation.ts
export function useConversation(options: UseConversationOptions) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const loadConversation = useCallback(async (id: string) => {
    // 加载会话逻辑
  }, [options]);

  return {
    conversationId,
    messages,
    loadConversation,
    // ...
  };
}
```

**应用**:
- `useConversation` — 会话管理
- `useGeneration` — 代码生成
- `useAIActions` — AI 操作
- `useShortcuts` — 快捷键
- `useNotification` — 通知

**优点**:
- 逻辑复用
- 状态封装
- 易于测试

---

### 4.2 回调模式（Callback Pattern）

**用途**: 通过回调函数实现组件间通信

**实现**:

```typescript
interface UseConversationOptions {
  onFormatChange?: (format: DiagramFormat) => void;
  onChartTypeChange?: (chartType: string) => void;
  onCodeClear?: () => void;
  onError?: (message: string) => void;
}
```

**应用**:
```typescript
const conversation = useConversation({
  onFormatChange: (f) => setFormat(f),
  onChartTypeChange: setCurrentChartType,
  onCodeClear: () => {
    setGeneratedCode('');
    setRenderData(null);
  },
  onError: (msg) => setApiError(msg),
});
```

**优点**:
- 解耦父子组件
- 灵活的事件处理
- 类型安全

---

## 五、文件索引

### 策略模式

| 文件 | 说明 |
|------|------|
| `lib/types/diagram-strategy.ts` | 图表策略接口定义 |
| `lib/strategies/excalidraw-strategy.ts` | Excalidraw 策略实现 |
| `lib/strategies/mermaid-strategy.ts` | Mermaid 策略实现 |
| `lib/strategies/drawio-strategy.ts` | Draw.io 策略实现 |
| `lib/strategies/registry.ts` | 策略注册表 |

### Provider 模式

| 文件 | 说明 |
|------|------|
| `lib/llm/providers/types.ts` | Provider 接口定义 |
| `lib/llm/providers/openai.ts` | OpenAI Provider 实现 |
| `lib/llm/providers/anthropic.ts` | Anthropic Provider 实现 |
| `lib/llm/providers/registry.ts` | Provider 注册表 |

### 数据库模式

| 文件 | 说明 |
|------|------|
| `lib/db/index.ts` | 数据库初始化（单例） |
| `lib/db/config-manager.ts` | 配置管理器（单例） |
| `lib/db/conversation-manager.ts` | 会话管理器（单例） |
| `lib/db/cache-manager.ts` | 缓存管理器（单例） |
| `lib/db/transaction.ts` | 事务辅助函数（模板方法） |

### API 模式

| 文件 | 说明 |
|------|------|
| `lib/api/with-error-handling.ts` | 错误处理装饰器 |
| `lib/api/sse-parser.ts` | SSE 解析器（中介者） |
| `lib/api/sse-consumer.ts` | SSE 消费者 |

### Hooks 模式

| 文件 | 说明 |
|------|------|
| `hooks/useConversation.ts` | 会话管理 Hook |
| `hooks/useGeneration.ts` | 代码生成 Hook |
| `hooks/useAIActions.ts` | AI 操作 Hook |
| `hooks/useShortcuts.ts` | 快捷键 Hook |
| `hooks/useNotification.ts` | 通知 Hook |

---

*最后更新：2026-06-04*
