# AI Sketch 项目优化路线图

本文档基于对整个项目的深度分析，列出所有需要优化的问题及其改进方案。

---

## 目录

- [一、项目现状概览](#一项目现状概览)
- [二、上下文管理](#二上下文管理)
- [三、数据库层](#三数据库层)
- [四、LLM 客户端与提示词](#四llm-客户端与提示词)
- [五、Editor 页面](#五editor-页面)
- [六、画布与渲染](#六画布与渲染)
- [七、Electron 桌面端](#七electron-桌面端)
- [八、策略模式与类型](#八策略模式与类型)
- [九、国际化与 UI](#九国际化与-ui)
- [十、优先级总结](#十优先级总结)

---

## 一、项目现状概览

### 架构亮点

- **策略模式深度运用** — DiagramStrategy + InputStrategy，图表格式可插拔扩展
- **全链路 SSE 流式处理** — Excalidraw 逐元素"实时生长"渲染
- **6 套 CSS 变量主题** — 毛玻璃 + 光晕 + 噪点纹理，视觉质感优秀
- **完善的文档体系** — 架构、API、扩展指南、Electron 测试报告

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js (App Router) | 16.0.1 |
| UI 库 | React | 19.2.0 |
| 语言 | TypeScript (strict) | 5.9.3 |
| 样式 | Tailwind CSS (CSS-first) | v4 |
| 数据库 | SQLite via sql.js (WASM) | 1.14.1 |
| 桌面端 | Electron + electron-builder | 28.3.3 |

> **重要说明**：本项目完全是桌面端应用，Web 模式仅用于开发时快速调试。

---

## 二、上下文管理

这是当前项目**最核心的问题**，直接影响图表生成质量。

### 2.1 截断策略缺陷

#### 问题 1：按条数而非 token 数截断（严重）

**位置**：`lib/db/conversation-manager.ts` `buildContextMessages` 方法

**现状**：使用 `MAX_CONTEXT_MESSAGES = 20` 作为阈值，不区分消息大小。

**影响**：
- 一条包含 base64 图片数据的 user 消息可能消耗数万 token
- 20 条长文本消息也可能远超模型上下文窗口
- 没有任何 token 预算管理机制

**改进方案**：
```typescript
// 伪代码示意
const MAX_CONTEXT_TOKENS = 8000; // 根据模型调整
let tokenBudget = MAX_CONTEXT_TOKENS;
const selectedMessages = [];

for (const msg of reversedMessages) {
  const tokens = estimateTokens(msg);
  if (tokenBudget - tokens < 0) break;
  selectedMessages.unshift(msg);
  tokenBudget -= tokens;
}
```

引入 token 计数（可用 tiktoken 或简单估算），按 token 预算而非条数截断。

---

#### 问题 2：截断通知以 assistant 角色插入（中等）

**位置**：`conversation-manager.ts` 第 366-372 行

**现状**：截断通知的 role 设为 `'assistant'`，破坏 user/assistant 交替规则。

**影响**：LLM 可能将截断通知误解为之前的对话回复，产生语义混乱。

**改进方案**：将截断通知的 role 改为 `'system'`，或直接在 system prompt 中说明上下文被截断。

---

#### 问题 3：中间轮次修改历史完全丢失（严重）

**现状**：当对话超过 20 轮时，中间的修改指令（如"把颜色改成蓝色"）被截断丢弃。

**影响**：
- 用户说"再调整一下布局"时，LLM 不知道当前代码做了哪些修改
- 图表代码的累积修改历史丢失

**改进方案**：
1. 保留首条消息 + 最近 N 条消息（当前方案）
2. 对被截断的中间消息生成**修改摘要**，作为 system 消息注入
3. 或者将当前代码变更 diff 作为上下文的一部分

---

#### 问题 4：首条消息未经 strategy 格式化（中等）

**位置**：`app/api/generate/route.ts` 第 140-144 行

**现状**：截断保留的第一条 user 消息是数据库中的原始输入，而非经过 `getUserPrompt()` 格式化的版本。

**影响**：与最后一条格式化后的消息风格不一致，LLM 收到的指令格式混乱。

**改进方案**：在 `buildContextMessages` 返回后，对首条 user 消息也应用 `getUserPrompt()` 格式化。

---

### 2.2 图片上下文污染

#### 问题 5：历史图片每次请求都重发（严重）

**位置**：`conversation-manager.ts` `toLLMMessage` → `parseStoredImages`

**现状**：存储到数据库的 base64 图片数据在每次请求时都被完整加载并发送给 LLM。

**影响**：
- 第 1 轮发送的 2MB 图片，到第 10 轮仍会被完整发送
- 大幅增加 API 调用的 token 消耗和请求延迟
- 可能超出模型的上下文窗口限制

**改进方案**：
1. **图片数据不入历史上下文**：只在当前轮次发送图片，历史消息中只保留图片的描述文字
2. **图片压缩**：存储前压缩到合理尺寸（如最大 1024px）
3. **图片摘要**：对历史图片生成文字描述替代原始数据

---

#### 问题 6：图片数据以 base64 存储在 messages 表（中等）

**位置**：`lib/db/conversation-manager.ts` `addMessage` 方法

**现状**：`image_data TEXT` 字段存储完整 base64 字符串。

**影响**：单行数据量极大，影响查询性能和数据库导出速度。

**改进方案**：
- 将图片存储为独立文件，messages 表只存文件路径
- 或使用 BLOB 类型替代 TEXT

---

### 2.3 System Prompt 浪费

#### 问题 7：每次请求发送全部 22 种图表规范（中等）

**位置**：`app/api/generate/route.ts` 第 147 行

**现状**：system prompt 包含所有 22 种图表类型的完整规范，无论用户请求的是哪种类型。

**影响**：约 90% 的图表规范是无用的 token 浪费。

**改进方案**：
```typescript
// 按图表类型裁剪 system prompt
function getSystemPrompt(chartType: string): string {
  const baseRules = getBaseSystemPrompt();
  const chartSpec = getChartSpec(chartType);
  return `${baseRules}\n\n${chartSpec}`;
}
```

只发送当前请求所需的图表类型规范。

---

#### 问题 8：system prompt 被重复调用（轻微）

**位置**：`app/api/generate/route.ts` 第 147 行和第 152 行

**现状**：`strategy.getSystemPrompt()` 在构建消息和日志中各调用一次。

**改进方案**：缓存到变量中复用。

---

### 2.4 错误消息污染

#### 问题 9：生成失败消息存入数据库（中等）

**位置**：`app/api/generate/route.ts` 第 222-228 行

**现状**：`[Generation failed: ...]` 作为 assistant 消息保存到数据库。

**影响**：后续请求的上下文中 LLM 会看到这个错误消息，可能影响生成质量。

**改进方案**：
1. 生成失败时不保存错误消息到数据库
2. 或标记为 `'system'` role，不参与上下文构建
3. 或添加 `is_error` 字段，在 `buildContextMessages` 中过滤

---

## 三、数据库层

### 3.1 写放大（严重）

**位置**：`lib/db/index.ts` `saveToDisk` 方法

**现状**：每次 `addMessage`、`update` 等操作都触发全量数据库导出 (`db.export()`) + 同步写盘 (`fs.writeFileSync`)。

**影响**：随数据增长 I/O 瓶颈严重，`writeFileSync` 阻塞事件循环。

**改进方案**：

```typescript
// 防抖写入
let saveTimer: NodeJS.Timeout | null = null;

function debouncedSaveToDisk() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveToDisk();
    saveTimer = null;
  }, 500);
}
```

改为防抖模式（500ms），多次写入合并为一次。或改为定时批量写入。

---

### 3.2 closeDb() 从未被调用（严重）

**位置**：`electron/main.ts`

**现状**：`window-all-closed` 事件仅调用 `stopServer()` + `app.quit()`，没有调用数据库的 `closeDb()`。

**影响**：应用退出时未持久化的脏数据丢失。

**改进方案**：

```typescript
// electron/main.ts
import { closeDb } from '../lib/db/index';

app.on('before-quit', async () => {
  await closeDb();
});
```

---

### 3.3 其他数据库问题

| # | 问题 | 严重度 | 说明 | 状态 |
|---|------|--------|------|------|
| 11 | **时间格式不统一** | 轻微 | `llm_configs` 用 ISO 字符串，其他表用毫秒时间戳 | ✅ 已修复 |
| 12 | **行映射使用数组索引** | 中等 | SQL 列顺序变化会静默出错，应改用 `getAsObject()` | ✅ 已修复 |
| 13 | **API Key 明文存储** | 中等 | 桌面端风险较低，但建议做简单加密混淆 | ✅ 已修复 |
| 14 | **ID 生成算法碰撞风险** | 轻微 | 建议改用 `crypto.randomUUID()` | ✅ 已修复 |

---

## 四、LLM 客户端与提示词

### 4.1 LLM 参数问题

#### 问题：temperature=1 对代码生成过高（严重）

**位置**：`lib/llm/client.ts`

**现状**：
- Anthropic: `temperature: 1`（第 356 行）— 最高随机性
- OpenAI: 未设置 temperature（第 290 行）— 使用默认值

**影响**：
- JSON 格式错误概率增加
- 元素坐标、尺寸等数值可能不一致
- 箭头绑定 id 可能不匹配
- 每次生成结果差异大

**改进方案**：
- 将 Anthropic 的 temperature 降到 0.3-0.5
- OpenAI 显式设置同样的值
- 暴露为用户可配置参数

---

#### 问题：max_tokens 硬编码且不一致（中等）✅

**现状**：已修复。`maxTokens` 改为每个 LLM 配置的独立参数，默认值统一为 16384。

---

#### 问题：LLM 生成失败后无自动重试（中等）✅

**现状**：已修复。新增全局重试机制，通过 NetworkSettings 配置重试次数（默认 2 次）。

**位置**：`app/api/generate/route.ts` 第 209-229 行、`lib/strategies/excalidraw-strategy.ts` `postProcess` 方法

**现状**：
- `postProcess` 有两级修复链（`repairJsonClosure` → `fixUnescapedQuotes`），但修复彻底失败后直接返回原始文本，不会请求 LLM 重新生成
- 用户只能手动点击"重新生成"按钮
- 429 限流有自动重试（`fetchWithRetry`，最多 3 次），但 JSON 格式错误没有重试

**影响**：
- LLM 输出格式错误时，用户看到的是损坏的代码或空白画布
- 用户需要手动操作才能重试，体验不流畅

**改进方案**：

```typescript
// 在 generate route 中添加自动重试逻辑
const MAX_AUTO_RETRIES = 2;

for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt++) {
  const rawCode = await streamFromLLM(messages);
  const processed = strategy.postProcess(rawCode);
  const validation = strategy.validate(processed);

  if (validation.valid) {
    // 成功，返回结果
    return processed;
  }

  if (attempt < MAX_AUTO_RETRIES) {
    // 在 user message 中添加错误反馈，让 LLM 知道上次输出有问题
    messages.push({
      role: 'assistant',
      content: rawCode,
    });
    messages.push({
      role: 'user',
      content: `上次生成的代码格式不正确（${validation.error}），请重新生成，确保输出有效的 ${strategy.codeLanguage} 格式。`,
    });
  }
}

// 所有重试都失败，返回最后一次的结果让 postProcess 做最佳修复
```

关键点：
1. 仅在 `validate` 失败时重试，而非网络错误（网络错误由 `fetchWithRetry` 处理）
2. 将错误反馈注入上下文，让 LLM 知道上次输出的问题
3. 限制最大重试次数（2 次），避免无限循环和 token 浪费
4. 重试对用户透明，SSE 流中可发送 `status` 事件提示"正在重试"

---

### 4.2 提示词系统问题

#### 问题：output 示例与要求矛盾（中等）✅

**现状**：已修复。移除示例中的代码块包裹，与要求一致。

---

#### 问题：坐标规划指导过于简单（中等）✅

**现状**：已修复。补充水平/垂直间距、起始坐标、每行密度、画布范围等具体策略。

---

#### 问题：AI Action 提示词间距矛盾（中等）✅

**现状**：已修复。layout 间距建议统一为 150-200px。

---

#### 问题：beautify 要求不支持的功能（中等）✅

**现状**：已修复。移除阴影/渐变要求，改用 Excalidraw 支持的 roundness 和 fillStyle。

---

#### 问题：CHART_TYPE_NAMES 重复三份（中等）

**位置**：`excalidraw/index.ts`、`mermaid/index.ts`、`drawio/index.ts`

**现状**：三个文件中完全相同的映射。

**改进方案**：提取到 `lib/diagram/constants.ts` 统一维护。

---

## 五、Editor 页面

### 5.1 状态管理

#### 问题：21 个 useState + 7 个 useRef（中等）

**位置**：`app/editor/page.tsx`

**现状**：状态碎片化，`isGenerating`/`isStreaming` 语义重叠但需同步设置。

**改进方案**：

```typescript
// 使用 useReducer 合并相关状态
type EditorState = {
  generation: { isGenerating: boolean; isStreaming: boolean; code: string };
  conversation: { id: string | null; messages: Message[] };
  config: { config: LLMConfig | null; loaded: boolean };
  // ...
};

const [state, dispatch] = useReducer(editorReducer, initialState);
```

或使用 Zustand 等轻量状态库。

---

#### 问题：sessionStorage 隐式耦合（中等）

**位置**：`lib/utils/init-data.ts`

**现状**：页面间通过 sessionStorage 传递数据，缺乏类型约束。

**改进方案**：定义明确的类型接口，或改用 URL 参数 + Context。

---

### 5.2 流式渲染

#### 问题：流式期间每帧 3 次 setState（中等）

**位置**：`app/editor/page.tsx` `onContent` 回调

**现状**：每个 SSE chunk 触发 `setGeneratedCode` + `feed()` + `setMessages`。

**改进方案**：

```typescript
// 使用 requestAnimationFrame 合并更新
const pendingUpdate = useRef<string>('');

onContent: (chunk) => {
  pendingUpdate.current += chunk;
  requestAnimationFrame(() => {
    setGeneratedCode(pendingUpdate.current);
    streamRendererRef.current?.feed(pendingUpdate.current);
    // messages 更新延迟到流结束后批量处理
  });
}
```

---

#### 问题：Mermaid/Draw.io 流式期间无预览（中等）

**现状**：用户只能看到代码增长，画布始终是空的直到流结束。

**改进方案**：
- Mermaid：使用 debounce（如 500ms）在流式期间间歇性尝试渲染
- Draw.io：类似策略，尝试解析不完整的 XML

---

### 5.3 UI 问题

#### 问题：panelWidth 不持久化（中等）

**改进方案**：

```typescript
// 保存到 localStorage
const [panelWidth, setPanelWidth] = useState(() => {
  const saved = localStorage.getItem('editor-panel-width');
  return saved ? parseInt(saved) : 360;
});

useEffect(() => {
  localStorage.setItem('editor-panel-width', panelWidth.toString());
}, [panelWidth]);
```

---

#### 问题：格式切换无确认对话框（中等）

**改进方案**：在生成过程中切换格式时弹出确认对话框。

---

## 六、画布与渲染

### 6.1 Excalidraw 画布

#### 问题：每个元素到达时完整重绘（中等）

**位置**：`components/canvases/ExcalidrawCanvas.tsx`

**现状**：每个新元素都调用 `updateScene({ elements: [...sceneRef.current] })`。

**改进方案**：批量更新，使用 debounce 合并多个元素的更新。

---

#### 问题：流式期间 scrollToContent 跳动（中等）

**现状**：每个新元素都调用 `scrollToContent`，画布视角不断跳动。

**改进方案**：仅在流结束后调用一次 `scrollToContent`，或使用 debounce。

---

#### 问题：元素转换失败静默吞没（中等）

**现状**：`catch { /* skip */ }` 不通知用户。

**改进方案**：收集失败的元素，在流结束后显示警告提示。

---

### 6.2 Mermaid 画布

#### 问题：14/21 种图表类型降级为 flowchart（严重）

**位置**：`lib/prompts/mermaid/chart-specs.ts` `MERMAID_TYPE_MAP`

**现状**：fishbone、swot、pyramid、venn 等类型实际只生成普通流程图。

**影响**：用户选择这些类型时无法获得预期效果。

**改进方案**：
1. **UI 层**：当格式为 Mermaid 时，隐藏不支持的图表类型选项
2. **或**：在选择时显示警告提示
3. **或**：使用 Mermaid 的 `block-beta` 等新语法尝试实现

---

### 6.3 Draw.io 画布

| # | 问题 | 严重度 | 改进方案 |
|---|------|--------|----------|
| 依赖外部 embed.diagrams.net | 中等 | 考虑本地化 Draw.io 编辑器 |
| 只读模式 | 中等 | 评估是否需要支持编辑 |
| CSS transform 缩放 | 轻微 | 改用 Draw.io 原生缩放 API |

---

## 七、Electron 桌面端

### 7.1 严重问题

#### 问题：closeDb() 从未被调用（严重）

已在 [数据库层](#32-closedb-从未被调用严重) 章节说明。

---

#### 问题：onMaximizeChange 监听器泄漏（严重）

**位置**：`electron/preload.ts`

**现状**：`ipcRenderer.on` 没有返回清理函数，`WindowControls.tsx` 中的 cleanup 逻辑可能失效。

**改进方案**：

```typescript
// electron/preload.ts
onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, value: boolean) => callback(value);
  ipcRenderer.on('window-maximize-changed', handler);
  // 返回清理函数
  return () => {
    ipcRenderer.removeListener('window-maximize-changed', handler);
  };
},
```

---

#### 问题：NSIS 卸载路径错误（严重）

**位置**：`electron/resources/uninstaller.nsh`

**现状**：删除的是 `$APPDATA\ai-sketch`，但 Electron 实际的 userData 路径是 `%APPDATA%\AI Sketch`。

**改进方案**：修正为正确的路径，或使用 `app.getPath('userData')` 通过 IPC 获取。

---

### 7.2 高优先级

| # | 问题 | 改进方案 |
|---|------|----------|
| 无崩溃恢复 | ✅ 已修复：监听 `render-process-gone`，弹窗提示重新加载 |
| 无自动更新 | 引入 `electron-updater`，配置 GitHub Releases 发布 |

---

### 7.3 中优先级

| # | 问题 | 改进方案 |
|---|------|----------|
| 窗口状态未持久化 | ✅ 已修复：保存到 `window-state.json`，启动时恢复 |
| 各页面重复 header | 抽取为共享 layout 组件 |
| 无全局 isElectron Context | 创建 `ElectronProvider` 在应用根部统一检测 |
| 服务器启动无超时 | 添加超时控制和加载进度提示 |

---

## 八、策略模式与类型

### 8.1 类型定义重复

| 问题 | 位置 | 改进方案 |
|------|------|----------|
| DiagramFormat 重复定义 | `lib/types/diagram-strategy.ts` + `lib/prompts/types.ts` | 统一到 `lib/types/` |
| SourceType / InputSourceType 重复 | `lib/types/index.ts` + `lib/types/input-strategy.ts` | 统一命名 |

---

### 8.2 策略实现问题

| # | 问题 | 位置 | 改进方案 | 状态 |
|---|------|------|----------|------|
| Mermaid VALID_STARTS 重复 | `mermaid-strategy.ts` | 删除内部硬编码，复用模块级常量 | ✅ 已修复 |
| ImageStrategy 全局可变状态 | `image-strategy.ts` | 改为 `buildMessage` 参数传入格式 | ✅ 已修复 |
| Excalidraw validate 不检查 schema | `excalidraw-strategy.ts` | 添加基本的元素结构校验 | ✅ 已修复 |
| postProcess 服务端/客户端职责模糊 | `drawio-strategy.ts` | 明确标注或统一行为 | ✅ 已修复 |

---

### 8.3 箭头优化

| # | 问题 | 改进方案 | 状态 |
|---|------|----------|------|
| 重叠元素处理不可预测 | 添加重叠检测，使用方向向量选择边缘 | ✅ 已修复 |
| 未考虑元素旋转角度 | 计算边缘中心点时应用旋转矩阵 | ✅ 已修复 |

---

## 九、国际化与 UI

### 9.1 国际化

| # | 问题 | 改进方案 | 状态 |
|---|------|----------|------|
| 不支持参数插值 | 实现 `t('key', { count: 5 })` 语法 | ✅ 已修复 |
| 硬编码中文字符串 | 全局搜索并替换为 i18n key | ✅ 已修复 |
| 模板 prompt 依赖翻译值 | 将 prompt 内容与翻译文本分离 | ✅ 已修复 |

---

### 9.2 消息气泡

#### 问题：代码 300 字符硬截断（严重）

**位置**：`components/ai/MessageBubble.tsx`

**现状**：没有展开/收起按钮，用户完全无法预览 AI 生成的代码。

**改进方案**：

```tsx
const [expanded, setExpanded] = useState(false);
const isLong = message.content.length > 300;
const displayContent = expanded ? message.content : message.content.substring(0, 300);

<pre className="...">
  <code>{displayContent}{isLong && !expanded && '...'}</code>
  {isLong && (
    <button onClick={() => setExpanded(!expanded)}>
      {expanded ? '收起' : '展开全部'}
    </button>
  )}
</pre>
```

---

### 9.3 输入策略

| # | 问题 | 改进方案 |
|---|------|----------|
| FileStrategy 不处理编码 | 添加编码检测或允许用户指定 |
| FileStrategy 不截断内容 | 对超过一定长度的内容进行截断或摘要 |

---

## 十、优先级总结

### 🔴 严重问题

| # | 问题 | 模块 | 状态 |
|---|------|------|------|
| 14 | 截断策略按条数而非 token 数 | 上下文管理 | ❌ |
| 15 | 中间轮次修改历史完全丢失 | 上下文管理 | ❌ |
| 16 | 历史图片每次请求都重发 | 上下文管理 | ❌ |
| 17 | 图片数据不入历史上下文 | 上下文管理 | ❌ |
| 18 | Mermaid 14/21 种类型降级 | Mermaid 画布 | ❌ |
| 19 | Excalidraw 流式期间每个元素完整重绘 | Excalidraw 画布 | ❌ |
| 20 | onMaximizeChange 监听器泄漏 | Electron | ✅ |
| 21 | NSIS 卸载路径错误 | Electron | ✅ |
| 6 | 数据库写放大 → 防抖模式 | 数据库 | ✅ |
| 7 | closeDb() 在 Electron 退出前调用 | 数据库/Electron | ✅ |
| 8 | Temperature 改为可配置参数 | LLM 客户端 | ✅ |
| 10 | 代码预览展开/收起按钮 | 消息气泡 | ✅ |

### 建议优先解决的 5 个未完成问题

1. **上下文截断改为 token 预算机制** — "上下文控制不好"的根本原因
2. **图片数据不入历史上下文** — 大幅降低 token 消耗
3. **历史图片不再每次重发** — 与上条配合，减少请求体积
4. **Excalidraw 流式 debounce** — 影响渲染性能和用户体验
5. **截断通知 role 修正** — 破坏 user/assistant 交替规则

### 🟡 中等问题（7 项）

详见附录 A，主要集中在：
- 上下文管理（截断通知 role、首条消息格式化、图片 base64 存储）
- 画布（scrollToContent 跳动、元素转换失败静默吞没）
- 输入策略（FileStrategy 编码/截断）
- Draw.io（外部依赖）

### 🟢 轻微问题（1 项）

详见附录 A：
- Draw.io（CSS transform 缩放）

---

## 附录 A：优化进度跟踪

> **图例**: ✅ 已完成 | ❌ 未开始
> **严重度**: 🔴 严重 | 🟡 中等 | 🟢 轻微

### ✅ 已完成（43 项）

| # | 优化项 | 严重度 | 完成日期 | 备注 |
|---|--------|--------|----------|------|
| 1 | 字体加载优化 (`font-display: swap`) | 🟢 | 2026-06-04 | `app/layout.tsx` |
| 2 | 数据库索引优化 | 🟢 | 2026-06-04 | `lib/db/index.ts` 添加 `idx_messages_created_at` |
| 3 | 动态导入优化（懒加载重型组件） | 🟢 | 2026-06-04 | ConfigSelector、BottomContextPanel、HistoryModal、LLMSettings |
| 4 | 数据库行映射改用 getAsObject() | 🟡 | 2026-06-04 | `config-manager.ts`、`conversation-manager.ts` |
| 5 | AI 响应缓存 | 🟡 | 2026-06-04 | `cache-manager.ts`、`route.ts` |
| 6 | 数据库写放大 → 防抖模式 | 🔴 | 2026-06-05 | `requestSave()` 500ms 防抖，`closeDb()` 时立即写盘 |
| 7 | closeDb() 在 Electron 退出前调用 | 🔴 | 2026-06-05 | `electron/main.ts` `window-all-closed` 中调用 |
| 8 | Temperature 改为可配置参数 | 🔴 | 2026-06-04 | 默认 0.5，UI 滑块控件 |
| 9 | 生成失败消息不存数据库 | 🟡 | 2026-06-04 | 避免上下文污染 |
| 10 | 代码预览展开/收起按钮 | 🔴 | 2026-06-04 | 默认收起，点击展开 |
| 11 | CHART_TYPE_NAMES 重复三份 → 共享常量 | 🟡 | 2026-06-04 | `lib/diagram/constants.ts` |
| 12 | 快捷键/关于页/LLM 复制国际化 | 🟡 | 2026-06-05 | descriptionKey 翻译、依赖描述翻译、编号后缀 |
| 13 | 缓存管理 API 暴露 + 数据清理集成 | 🟡 | 2026-06-05 | clear-cache/cache-stats action、DataSettings 集成 |
| 14 | NSIS 卸载路径修正 | 🔴 | 2026-06-05 | appId 改为 ai-sketch，与卸载脚本路径一致 |
| 15 | onMaximizeChange 监听器泄漏修复 | 🔴 | 2026-06-05 | preload.ts 返回清理函数，WindowControls 正确调用 |
| 16 | max_tokens 改为可配置参数 | 🟡 | 2026-06-05 | 每个 LLM 配置独立设置，默认 16384 |
| 17 | LLM 生成失败自动重试 | 🟡 | 2026-06-05 | 全局配置（NetworkSettings），默认 2 次重试 |
| 18 | 时间格式统一为 Unix 时间戳 | 🟢 | 2026-06-05 | `llm_configs` 的 `created_at`/`updated_at` 改为 INTEGER |
| 19 | API Key 加密存储 | 🟢 | 2026-06-05 | AES-256-GCM，密钥存 `ai-sketch.db.key` |
| 20 | DiagramFormat 重复定义 | 🟢 | 2026-06-05 | 统一从 `lib/types/diagram-strategy` 导入 |
| 21 | SourceType/InputSourceType 未统一 | 🟢 | 2026-06-05 | 移除 InputSourceType，统一用 SourceType |
| 22 | Mermaid VALID_STARTS 重复 | 🟢 | 2026-06-05 | postProcess 复用模块级常量 |
| 23 | constants.ts 遗留死注释 | 🟢 | 2026-06-05 | 移除 `// Must match CHART_TYPE_NAMES` |
| 24 | output 示例与要求矛盾 | 🟡 | 2026-06-05 | 移除示例中的代码块包裹 |
| 25 | 坐标规划指导过于简单 | 🟡 | 2026-06-05 | 补充水平/垂直间距、起始坐标、密度、画布范围 |
| 26 | AI Action 提示词间距矛盾 | 🟡 | 2026-06-05 | layout 间距统一为 150-200px |
| 27 | beautify 要求不支持的功能 | 🟡 | 2026-06-05 | 移除阴影/渐变，改用 roundness/fillStyle |
| 28 | getSystemPrompt 重复调用 | 🟢 | 2026-06-05 | 缓存到变量复用 |
| 29 | system prompt 全部图表规范 | 🟡 | 2026-06-05 | 已验证：system prompt 不含规范，user prompt 按需注入 |
| 30 | Electron 崩溃恢复 | 🟡 | 2026-06-05 | 监听 render-process-gone，弹窗提示重新加载 |
| 31 | 窗口状态持久化 | 🟢 | 2026-06-05 | 保存到 userData/window-state.json，启动时恢复 |
| 32 | Electron 自动更新 | 🟡 | 2026-06-05 | electron-updater + UpdateBanner + AboutSettings 手动检查 |
| 33 | ImageStrategy 全局可变状态 | 🟢 | 2026-06-05 | 移除 setDiagramFormat，改为 buildMessage 参数传入 |
| 34 | Excalidraw validate 不检查 schema | 🟡 | 2026-06-05 | 添加 type/x/y 必填字段校验 + 合法类型白名单 |
| 35 | Draw.io postProcess 服务端/客户端不一致 | 🟡 | 2026-06-05 | 移除 DOMParser 依赖，统一使用字符串匹配 |
| 36 | 箭头重叠元素处理 | 🟢 | 2026-06-05 | 包围盒重叠检测 + 方向向量回退策略 |
| 37 | 箭头旋转角度支持 | 🟢 | 2026-06-05 | ExcalidrawElement.rotation + 旋转矩阵变换 |
| 38 | t() 参数插值 | 🟡 | 2026-06-05 | t('key', { param: value }) 语法 + 全局替换 .replace() |
| 39 | UI 组件硬编码中文 | 🟡 | 2026-06-05 | upload/toolbar/lang 等组件改用 i18n key |
| 40 | Prompt 语言适配 | 🟡 | 2026-06-05 | 添加 LANGUAGE_RULE，LLM 根据用户输入语言生成标签 |
| 41 | ID 生成改用 crypto.randomUUID() | 🟢 | 2026-06-05 | 消除 Date.now+Math.random 碰撞风险 |
| 42 | useState 碎片化 → useReducer | 🟡 | 2026-06-05 | config/result 状态改用 reducer，14→8 useState |
| 43 | sessionStorage 类型约束 | 🟢 | 2026-06-05 | init-data.ts 已有 InitData 接口，类型安全 |

### ❌ 未完成 — 严重（6 项）

| # | 优化项 | 模块 | 说明 |
|---|--------|------|------|
| 14 | 截断策略按条数而非 token 数 | 上下文管理 | `MAX_CONTEXT_MESSAGES=20`，无 token 预算 |
| 15 | 中间轮次修改历史完全丢失 | 上下文管理 | 无摘要机制，超 20 轮直接丢弃 |
| 16 | 历史图片每次请求都重发 | 上下文管理 | `toLLMMessage` 无条件附带所有 base64 图片 |
| 17 | 图片数据不入历史上下文 | 上下文管理 | 只在当前轮次发送图片，历史保留描述文字 |
| 18 | Mermaid 14/21 种类型降级为 flowchart | Mermaid 画布 | `MERMAID_TYPE_MAP` 未改 |
| 19 | Excalidraw 流式每元素完整重绘 | Excalidraw 画布 | `feed()` 无 debounce，每元素调 `updateScene` |

### ❌ 未完成 — 中等（7 项）

| # | 优化项 | 模块 | 说明 |
|---|--------|------|------|
| 22 | 截断通知 role 为 assistant 应为 system | 上下文管理 | 破坏 user/assistant 交替规则 |
| 23 | 首条消息未经 getUserPrompt 格式化 | 上下文管理 | 历史消息原始发送，与当前轮次格式不一致 |
| 24 | 图片以 base64 TEXT 存储 | 上下文管理 | 单行数据量极大，影响查询性能 |
| 25 | scrollToContent 流式期间每元素调用 | Excalidraw 画布 | 画布视角不断跳动 |
| 26 | 元素转换失败静默吞没 | Excalidraw 画布 | `catch { /* skip */ }` 无日志无提示 |
| 27 | FileStrategy 不处理编码/截断 | 输入策略 | 无编码检测，超长内容无截断 |
| 28 | Draw.io 依赖外部 embed.diagrams.net | Draw.io 画布 | 需联网，考虑本地化 |

### ❌ 未完成 — 轻微（1 项）

| # | 优化项 | 模块 | 说明 |
|---|--------|------|------|
| 34 | Draw.io CSS transform 缩放 | Draw.io 画布 | 应改用原生缩放 API |

---

## 附录 B：关键文件索引

| 用途 | 路径 |
|------|------|
| 上下文管理 | `lib/db/conversation-manager.ts` |
| 数据库初始化 | `lib/db/index.ts` |
| LLM 客户端 | `lib/llm/client.ts` |
| 生成路由 | `app/api/generate/route.ts` |
| Editor 页面 | `app/editor/page.tsx` |
| Excalidraw 策略 | `lib/strategies/excalidraw-strategy.ts` |
| Mermaid 策略 | `lib/strategies/mermaid-strategy.ts` |
| Draw.io 策略 | `lib/strategies/drawio-strategy.ts` |
| 系统提示词 | `lib/prompts/excalidraw/system.ts` |
| 图表规范 | `lib/prompts/excalidraw/chart-specs.ts` |
| Electron 主进程 | `electron/main.ts` |
| Electron 预加载 | `electron/preload.ts` |
| Excalidraw 画布 | `components/canvases/ExcalidrawCanvas.tsx` |
| Mermaid 画布 | `components/canvases/MermaidCanvas.tsx` |
| 消息气泡 | `components/ai/MessageBubble.tsx` |
| 窗口控制 | `components/layout/WindowControls.tsx` |
