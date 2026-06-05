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

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 10 | **缺少 Migration 机制** | 中等 | `CREATE TABLE IF NOT EXISTS` 不支持 schema 变更 |
| 11 | **时间格式不统一** | 轻微 | `llm_configs` 用 ISO 字符串，其他表用毫秒时间戳 |
| 12 | **行映射使用数组索引** | 中等 | SQL 列顺序变化会静默出错，应改用 `getAsObject()` |
| 13 | **API Key 明文存储** | 中等 | 桌面端风险较低，但建议做简单加密混淆 |
| 14 | **ID 生成算法碰撞风险** | 轻微 | 建议改用 `crypto.randomUUID()` |

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

#### 问题：max_tokens 硬编码且不一致（中等）

**现状**：
- Anthropic: `max_tokens: 64000`
- OpenAI: `max_tokens: 16384`

**影响**：两个 provider 差异 4 倍，无法根据图表类型或模型调整。

**改进方案**：暴露为配置参数，提供合理的默认值。

---

### 4.2 提示词系统问题

#### 问题：output 示例与要求矛盾（中等）

**位置**：`lib/prompts/excalidraw/system.ts` 第 19-25 行

**现状**：要求"不要用代码块包裹"但示例用了代码块。

**改进方案**：移除示例中的代码块包裹，保持与要求一致。

---

#### 问题：坐标规划指导过于简单（中等）

**现状**：仅说"间距大于 800px"，无具体坐标规划策略。

**影响**：LLM 不知道如何系统性规划坐标，导致元素间距不均匀、密度差异大。

**改进方案**：提供坐标规划模板，如：
```
对于 N 个节点的流程图：
- 水平间距：200px
- 垂直间距：150px
- 起始坐标：(100, 100)
- 每行最多 4 个节点
```

---

#### 问题：AI Action 提示词矛盾（中等）

**位置**：`lib/prompts/ai-actions/layout.ts` vs `excalidraw/system.ts`

**现状**：layout 要求"80-120px 间距" vs system prompt 要求"大于 800px"。

**改进方案**：统一间距建议，或说明不同场景下的不同要求。

---

#### 问题：beautify 要求不支持的功能（中等）

**位置**：`lib/prompts/ai-actions/beautify.ts`

**现状**：要求"阴影/渐变效果"但 Excalidraw skeleton API 不支持。

**改进方案**：移除不支持的功能要求，或改用 Excalidraw 支持的样式属性。

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
| 无崩溃恢复 | 添加 `webContents.on('render-process-gone')` 监听，显示错误页面或重启 |
| 无自动更新 | 引入 `electron-updater`，配置 GitHub Releases 发布 |
| macOS 缺少公证 | 添加 `afterSign` 钩子调用 `notarytool` |
| macOS 缺少标准菜单 | 为 macOS 添加标准应用菜单 |

---

### 7.3 中优先级

| # | 问题 | 改进方案 |
|---|------|----------|
| 窗口状态未持久化 | 监听 `resize`/`move` 事件，保存 bounds 到 electron-store |
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

| # | 问题 | 位置 | 改进方案 |
|---|------|------|----------|
| Mermaid VALID_STARTS 重复 | `mermaid-strategy.ts` | 删除内部硬编码，复用模块级常量 |
| ImageStrategy 全局可变状态 | `image-strategy.ts` | 改为 `buildMessage` 参数传入格式 |
| Excalidraw validate 不检查 schema | `excalidraw-strategy.ts` | 添加基本的元素结构校验 |
| postProcess 服务端/客户端职责模糊 | `drawio-strategy.ts` | 明确标注或统一行为 |

---

### 8.3 箭头优化

| # | 问题 | 改进方案 |
|---|------|----------|
| 重叠元素处理不可预测 | 添加重叠检测，跳过或使用默认边缘 |
| 未考虑元素旋转角度 | 计算边缘中心点时应用旋转矩阵 |

---

## 九、国际化与 UI

### 9.1 国际化

| # | 问题 | 改进方案 |
|---|------|----------|
| 不支持参数插值 | 实现 `t('key', { count: 5 })` 语法 |
| 硬编码中文字符串 | 全局搜索并替换为 i18n key |
| 模板 prompt 依赖翻译值 | 将 prompt 内容与翻译文本分离 |

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

### 🔴 严重问题（12 项）

| # | 问题 | 模块 |
|---|------|------|
| 1 | 截断策略按条数而非 token 数 | 上下文管理 |
| 2 | 中间轮次修改历史完全丢失 | 上下文管理 |
| 3 | 历史图片每次请求都重发 | 上下文管理 |
| 4 | Anthropic temperature=1 | LLM 客户端 |
| 5 | 数据库写放大 | 数据库 |
| 6 | closeDb() 从未被调用 | 数据库/Electron |
| 7 | onMaximizeChange 监听器泄漏 | Electron |
| 8 | NSIS 卸载路径错误 | Electron |
| 9 | Mermaid 14/21 种类型降级 | Mermaid 画布 |
| 10 | 代码 300 字符硬截断 | 消息气泡 |
| 11 | 流式期间每帧 3 次 setState | Editor 页面 |
| 12 | Excalidraw 流式期间每个元素完整重绘 | Excalidraw 画布 |

### 建议优先解决的 5 个问题

1. **上下文截断改为 token 预算机制** — "上下文控制不好"的根本原因
2. **数据库写放大改为防抖模式** — 影响所有用户的性能
3. **closeDb() 在 Electron 退出前调用** — 防止数据丢失
4. **降低 temperature 到 0.3-0.5** — 直接提升生成质量
5. **图片数据不入历史上下文** — 大幅降低 token 消耗

### 🟡 中等问题（48 项）

详见各章节，主要集中在：
- 状态管理碎片化（Editor 21 个 useState）
- 流式渲染体验不完整（Mermaid/Draw.io 无预览）
- 提示词质量（矛盾、抽象、不支持的功能）
- 国际化不完整（硬编码中文、无参数插值）
- Electron 功能缺失（无自动更新、无崩溃恢复）

### 🟢 轻微问题（27 项）

详见各章节，主要集中在：
- 代码风格（DRY 违反、类型断言）
- 性能微调（代理缓存 TTL、JSON.stringify hash）
- 死代码（未使用的 API、未调用的函数）
- UI 细节（按钮尺寸、注释不一致）

---

## 附录：关键文件索引

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
