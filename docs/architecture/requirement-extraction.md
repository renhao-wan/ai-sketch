# 需求提取（Requirement Extraction）

需求提取是 AI Sketch 的核心功能之一，负责将用户的任意输入转化为最适合生成图表的结构化描述，同时评估图表的复杂度。

## 概述

需求提取采用**两阶段 Pipeline** 架构：

1. **需求提取阶段**：调用 LLM 从用户输入中提取结构化需求描述
2. **模式判断阶段**：基于 LLM 的复杂度评估决定使用快速还是高质量模式

```
用户输入
    ↓
需求提取 LLM（带 structured output）
    ↓
返回 JSON：{ requirement, complexity }
    ↓
complexity === 'complex'？
    ├── 是 → 高质量模式
    └── 否 → 快速模式
```

## 需求提取开关

用户可以在生成模式下拉菜单中控制是否使用需求提取功能：

- **开启（默认）**：使用 LLM 提取的需求描述生成图表
- **关闭**：仍然进行需求提取（获取 complexity），但使用用户原始输入生成图表

### 开关位置

在输入框底部的生成模式下拉菜单中，有一个「需求提取」选项：

```
⚡ 快速
🤖 自动
🎯 高质量
─────────
✨ 需求提取 ON/OFF
```

### 关闭后的行为

关闭需求提取后：
1. **第一阶段不变**：仍然调用 LLM 进行需求提取，获取 complexity
2. **第二阶段改变**：不使用 LLM 提取的 requirement，直接使用用户原始输入
3. **模式判断不变**：仍然使用 LLM 的 complexity 来判断使用快速还是高质量模式

```
用户输入
    ↓
需求提取 LLM → { requirement, complexity }
    ↓
useRequirementExtraction = false？
    ├── 是 → 使用用户原始输入 + complexity
    └── 否 → 使用 requirement + complexity
```

## 核心组件

### 1. 需求提取模块

**文件**：`lib/generation/requirement-extractor.ts`

**职责**：
- 从用户输入中提取结构化需求描述
- 评估图表的复杂度（simple/medium/complex）
- 使用 structured output 确保返回 JSON 格式

**接口**：
```typescript
export interface ExtractionResult {
  requirement: string;  // 提取后的结构化需求描述
  complexity: 'simple' | 'medium' | 'complex';  // 复杂度评估
}

export async function extractRequirements(
  userInput: string,
  config: LLMConfig,
  signal?: AbortSignal,
): Promise<ExtractionResult>;
```

### 2. 需求提取开关

**文件**：
- `components/ai/GenerationModeToggle.tsx`：UI 组件
- `hooks/useGeneration.ts`：状态管理
- `app/api/generate/route.ts`：后端逻辑

**职责**：
- 提供 UI 开关，让用户控制是否使用需求提取
- 将开关状态传递给后端
- 后端根据开关决定是否使用 LLM 提取的 requirement

### 2. System Prompt

**复杂度评估标准**：
- **simple（简单）**：5 个以下节点，简单线性流程，无分支或少量分支
- **medium（中等）**：5-15 个节点，有分支和合并，中等复杂度的关系
- **complex（复杂）**：15 个以上节点，多层次结构，复杂的关系网络

**图表描述的写作规范**：
1. 明确实体：列出图表中的所有节点/元素
2. 明确关系：节点之间的连接、依赖、包含关系
3. 明确流程：如果是流程图，按步骤列出
4. 明确层次：如果是层次图，说明层级结构
5. 去除噪声：忽略解释性文字、背景知识、数字细节
6. 语言跟随：使用与输入相同的语言

### 3. Structured Output

使用 JSON Schema 确保 LLM 返回符合要求的 JSON 格式：

```typescript
const EXTRACTION_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'extraction_result',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        requirement: {
          type: 'string',
          description: '提取后的结构化图表描述',
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'medium', 'complex'],
          description: '图表复杂度评估',
        },
      },
      required: ['requirement', 'complexity'],
      additionalProperties: false,
    },
  },
};
```

**各 Provider 的支持情况**：

| Provider | Structured Output | 说明 |
|----------|------------------|------|
| **OpenAI** | ✅ 支持 | 使用 `response_format` 参数 |
| **Anthropic** | ❌ 不支持 | 忽略 `responseFormat`，依赖 System Prompt |
| **Ollama** | ✅ 支持 | 继承 OpenAI，使用 `response_format` 参数 |

## 数据流

### 完整流程

```
用户输入
    ↓
API Route（POST /api/generate）
    ↓
解析请求参数（包括 useRequirementExtraction）
    ↓
加载 LLM 配置
    ↓
创建/获取会话，保存用户消息
    ↓
图片处理（如果有）
    ↓
判断是否跳过需求提取：
    - 图片输入 → 跳过
    - 重新生成 → 跳过
    - 编辑模式 → 跳过
    - 用户关闭需求提取 → 跳过
    - 其他 → 调用需求提取 LLM
    ↓
需求提取 LLM（带 structured output）
    ↓
返回 ExtractionResult：
    - requirement: 提取后的需求描述
    - complexity: 复杂度评估
    ↓
判断是否使用需求提取结果：
    - useRequirementExtraction = true → 使用 requirement
    - useRequirementExtraction = false → 使用用户原始输入
    ↓
模式判断：
    - auto 模式：基于 complexity 判断
    - quality 模式：强制使用高质量
    - fast 模式：强制使用快速
    ↓
缓存检查（基于 requirementForLLM + mode 计算缓存键）
    ↓
缓存命中？
├── 是 → 直接返回缓存结果
└── 否 → 生图 LLM
            ↓
        后处理
            ↓
        保存结果
            ↓
        返回结果
```

### 降级策略

需求提取失败时，系统会降级到基于输入长度的简单判断：

```
需求提取失败
    ↓
catch 块：
    - requirementForLLM = userContent（原始输入）
    - extractionResult = null
    ↓
模式判断：
    - extractionResult 存在：使用 LLM 的 complexity
    - extractionResult 为 null：使用长度判断
      - userContent.length >= 500 → 高质量模式
      - userContent.length < 500 → 快速模式
```

## 跳过需求提取的情况

以下情况会跳过需求提取，直接使用原始输入：

1. **图片输入**：图片有自己的处理管线（vision API 或 OCR）
2. **重新生成**：使用原有的需求描述
3. **编辑模式**：使用编辑后的需求描述
4. **用户关闭需求提取**：用户在 UI 中关闭了需求提取开关

**注意**：即使跳过需求提取，系统仍然会进行复杂度评估（基于用户原始输入的长度），用于自动模式的模式判断。

## 缓存策略

缓存键基于以下因素计算：
- `requirementForLLM`：提取后的需求描述（或原始输入）
- `format`：图表格式（excalidraw/mermaid/drawio）
- `chartType`：图表类型
- `model`：LLM 模型
- `configName`：配置名称
- `contextHash`：上下文哈希
- `mode`：生成模式（fast/quality）

**缓存命中时**：
- 跳过需求提取
- 跳过生图 LLM
- 直接返回缓存结果

## 性能考虑

### 延迟影响

- **缓存命中**：无额外延迟
- **缓存未命中**：增加一次 LLM 调用（约 2-5 秒）

### 优化建议

1. **使用更轻量的模型**：需求提取不需要很强的模型能力
2. **缓存需求提取结果**：基于原始输入缓存提取结果
3. **并行处理**：在等待需求提取时，可以预加载其他资源

## 错误处理

### 需求提取失败

```typescript
try {
  extractionResult = await extractRequirements(userContent, config, signal);
  requirementForLLM = extractionResult.requirement;
} catch (error) {
  console.error('[Generate] 需求提取失败，降级使用原始输入:', error);
  requirementForLLM = userContent;
  extractionResult = null;
}
```

### JSON 解析失败

如果 LLM 返回的 JSON 格式错误，`extractRequirements` 会抛出错误，由调用方处理降级逻辑。

## 文件结构

```
lib/generation/
├── requirement-extractor.ts  # 需求提取模块
├── complexity-assessor.ts    # 复杂度评估（降级方案）
├── planner.ts                # 高质量模式的步骤规划
├── multi-pass-generator.ts   # 高质量模式的多轮生成
├── critic.ts                 # 高质量模式的规则校验
└── types.ts                  # 共享类型定义

lib/llm/
├── client.ts                 # LLM 客户端（支持 structured output）
└── providers/
    ├── openai.ts             # OpenAI provider（支持 response_format）
    ├── anthropic.ts          # Anthropic provider（不支持 structured output）
    └── ollama.ts             # Ollama provider（继承 OpenAI）

components/ai/
├── GenerationModeToggle.tsx  # 生成模式切换组件（包含需求提取开关）
├── ChatInput.tsx             # 输入框组件
└── AICopilotPanel.tsx        # AI 面板组件

hooks/
└── useGeneration.ts          # 生成逻辑 hook（管理需求提取开关状态）

app/page.tsx                  # 主页面（管理需求提取开关状态）

app/api/generate/
└── route.ts                  # API 路由（协调整个流程）
```

## 示例

### 输入示例

**简单输入**：
```
画一个用户登录流程图
```

**提取结果**：
```json
{
  "requirement": "创建用户登录流程图，包含以下步骤：\n1. 用户输入用户名和密码\n2. 前端验证输入格式\n3. 调用后端 API\n4. 返回结果",
  "complexity": "simple"
}
```

**模式判断**：simple → 快速模式

---

**复杂输入**：
```
画一个包含 30 个微服务的完整架构图，分为 6 层，包含数据库集群、缓存集群、消息队列集群、API 网关集群、负载均衡器、监控系统等组件，服务之间有复杂的调用关系、依赖关系、数据流关系
```

**提取结果**：
```json
{
  "requirement": "创建完整架构图，包含 30 个微服务，分为 6 层，包含数据库集群、缓存集群、消息队列集群、API 网关集群、负载均衡器、监控系统等组件，服务之间有复杂的调用关系、依赖关系、数据流关系",
  "complexity": "complex"
}
```

**模式判断**：complex → 高质量模式

### 需求提取开关示例

**场景**：用户想要保留原始输入的完整性，不使用 LLM 提取的需求

**输入**：
```
画一个用户登录流程图，包含：输入用户名密码、验证、成功跳转首页、失败显示错误
```

**开启需求提取**（默认）：
- LLM 提取的需求：`创建用户登录流程图，包含以下步骤...`
- 使用 LLM 提取的需求生成图表

**关闭需求提取**：
- LLM 仍然返回 `{ requirement: "...", complexity: "simple" }`
- 但不使用 LLM 提取的 requirement
- 直接使用用户原始输入：`画一个用户登录流程图，包含：输入用户名密码、验证、成功跳转首页、失败显示错误`
- complexity 仍然用于模式判断（simple → 快速模式）

---

## 相关文档

- [生成模式](./generation-mode.md) — 快速/自动/高质量三种生成模式
- [图表格式策略模式](./diagram-strategy.md) — DiagramStrategy 接口详解
- [响应缓存](./response-cache.md) — L1/L2 分层缓存架构
- [API 接口文档](../api/endpoints.md) — 后端 API 接口说明
