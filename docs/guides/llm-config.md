# LLM 配置指南

本文档介绍如何配置和使用各种 LLM 服务提供商。

## 概述

AI Sketch 支持三种类型的 LLM API：

| 类型 | 说明 | 典型服务商 |
|------|------|-----------|
| **OpenAI** | OpenAI 兼容接口（`/chat/completions`） | OpenAI、DeepSeek、Moonshot、vLLM |
| **Anthropic** | Anthropic 原生接口（`/messages`） | Claude 系列模型 |
| **Ollama** | Ollama 本地部署接口（`/api/chat`） | Ollama 本地模型 |

## 配置入口

进入设置页面（`/settings`），选择 **LLM** 标签页。

## 添加配置

### 步骤 1：点击"新建配置"

### 步骤 2：填写配置信息

| 字段 | 必填 | 说明 |
|------|------|------|
| 配置名称 | ✅ | 自定义名称，便于识别 |
| 描述 | ❌ | 可选的描述信息 |
| 提供商类型 | ✅ | 选择 `OpenAI` 或 `Anthropic` |
| Base URL | ✅ | API 基础地址 |
| API Key | ✅ | API 密钥 |
| 模型 | ✅ | 模型名称 |

### 步骤 3：测试连接

点击"测试连接"按钮验证配置是否正确。

### 步骤 4：设为活跃配置

点击配置右侧的 ✓ 按钮将其设为默认使用的配置。

---

## OpenAI 兼容接口配置

### OpenAI 官方

| 字段 | 值 |
|------|-----|
| 提供商类型 | `OpenAI` |
| Base URL | `https://api.openai.com/v1` |
| API Key | `sk-...` |
| 模型 | `gpt-4o`、`gpt-4o-mini`、`gpt-4-turbo` |

### DeepSeek

| 字段 | 值 |
|------|-----|
| 提供商类型 | `OpenAI` |
| Base URL | `https://api.deepseek.com/v1` |
| API Key | `sk-...` |
| 模型 | `deepseek-chat`、`deepseek-coder` |

### Moonshot（月之暗面）

| 字段 | 值 |
|------|-----|
| 提供商类型 | `OpenAI` |
| Base URL | `https://api.moonshot.cn/v1` |
| API Key | `sk-...` |
| 模型 | `moonshot-v1-8k`、`moonshot-v1-32k`、`moonshot-v1-128k` |

### 智谱 AI（ChatGLM）

| 字段 | 值 |
|------|-----|
| 提供商类型 | `OpenAI` |
| Base URL | `https://open.bigmodel.cn/api/paas/v4` |
| API Key | `...` |
| 模型 | `glm-4`、`glm-4-flash`、`glm-4v` |

### 阿里云（通义千问）

| 字段 | 值 |
|------|-----|
| 提供商类型 | `OpenAI` |
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| API Key | `sk-...` |
| 模型 | `qwen-turbo`、`qwen-plus`、`qwen-max` |

### 百度（文心一言）

| 字段 | 值 |
|------|-----|
| 提供商类型 | `OpenAI` |
| Base URL | `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop` |
| API Key | `...` |
| 模型 | `ernie-4.0-8k`、`ernie-3.5-8k` |

### Ollama（本地部署）

| 字段 | 值 |
|------|-----|
| 提供商类型 | `Ollama` |
| Base URL | `http://localhost:11434` |
| API Key | 留空或任意值 |
| 模型 | `llama3`、`qwen2`、`deepseek-coder` |

**前提条件**：已安装并运行 Ollama，且已拉取模型。

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取模型
ollama pull llama3
ollama pull qwen2

# 启动服务（默认端口 11434）
ollama serve
```

**说明**：
- Ollama 使用专用的 Provider，无需 API Key
- 自动处理 `/api/chat` 端点和请求格式
- 模型列表通过 `/api/tags` 端点获取

### vLLM（本地部署）

| 字段 | 值 |
|------|-----|
| 提供商类型 | `OpenAI` |
| Base URL | `http://localhost:8000/v1` |
| API Key | `token-abc`（任意值） |
| 模型 | 取决于加载的模型 |

```bash
# 启动 vLLM 服务
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-8B-Instruct \
  --port 8000
```

### LM Studio（本地部署）

| 字段 | 值 |
|------|-----|
| 提供商类型 | `OpenAI` |
| Base URL | `http://localhost:1234/v1` |
| API Key | `lm-studio`（任意值） |
| 模型 | 取决于加载的模型 |

---

## Anthropic API 配置

### Claude 官方

| 字段 | 值 |
|------|-----|
| 提供商类型 | `Anthropic` |
| Base URL | `https://api.anthropic.com/v1` |
| API Key | `sk-ant-...` |
| 模型 | `claude-3-5-sonnet-20241022`、`claude-3-opus-20240229`、`claude-3-haiku-20240307` |

**注意事项**：
- Anthropic API 不支持 `/models` 端点，需要手动输入模型名称
- 部分地区可能需要代理才能访问

---

## 代理配置

### 方式 1：应用内配置（推荐）

进入设置页面 → **网络** 标签页，配置 HTTP 代理：

| 字段 | 示例 |
|------|------|
| 代理地址 | `http://127.0.0.1:7890` |
| 启用代理 | ✅ |

### 方式 2：环境变量

```bash
# Windows
set HTTPS_PROXY=http://127.0.0.1:7890
set HTTP_PROXY=http://127.0.0.1:7890

# Linux/macOS
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

### 优先级

1. 应用内配置（数据库存储）
2. 环境变量

---

## 高级功能

### 导入/导出配置

- **导出**：点击"导出"按钮，下载 JSON 文件
- **导入**：点击"导入"按钮，选择 JSON 文件

配置文件格式：

```json
[
  {
    "name": "DeepSeek",
    "type": "openai",
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKey": "sk-...",
    "model": "deepseek-chat",
    "description": "DeepSeek V3"
  }
]
```

### 克隆配置

点击配置右侧的复制按钮，快速创建相似配置。

### 多配置管理

- 可以创建多个配置，用于不同场景
- 只有一个配置可以设为"活跃"状态
- 生成图表时默认使用活跃配置

---

## 故障排除

### 连接测试失败

**问题**：点击"测试连接"后显示失败

**可能原因**：
1. Base URL 不正确
2. API Key 无效
3. 网络问题（需要代理）
4. 模型不存在

**解决方案**：
1. 检查 Base URL 是否正确（注意末尾是否有 `/`）
2. 确认 API Key 有效
3. 配置代理
4. 点击"加载模型"获取可用模型列表

### 模型列表为空

**问题**：点击"加载模型"后列表为空

**可能原因**：
1. API 不支持 `/models` 端点（如 Anthropic）
2. 网络问题

**解决方案**：
- 对于 Anthropic：手动输入模型名称
- 检查网络连接和代理配置

### 生成超时

**问题**：生成图表时提示超时

**可能原因**：
1. 模型响应慢
2. 网络延迟
3. 输出内容过长

**解决方案**：
1. 尝试使用更快的模型
2. 检查网络连接
3. 简化图表描述

### 429 速率限制

**问题**：提示 "Rate limited (429)"

**说明**：应用会自动重试（最多 3 次），使用指数退避策略

**解决方案**：
1. 等待一段时间后重试
2. 升级 API 套餐
3. 使用其他服务商

---

## 推荐配置

### 开发测试

| 场景 | 推荐配置 |
|------|----------|
| 快速原型 | DeepSeek Chat（性价比高） |
| 复杂图表 | Claude 3.5 Sonnet（理解能力强） |
| 本地离线 | Ollama + Llama 3（免费） |

### 生产环境

| 场景 | 推荐配置 |
|------|----------|
| 高质量 | GPT-4o 或 Claude 3 Opus |
| 高并发 | DeepSeek Chat 或 GPT-4o Mini |
| 成本敏感 | DeepSeek Chat 或 Qwen Turbo |

---

## 相关文档

- [架构概览](../architecture/overview.md) — 整体架构设计
- [API 接口文档](../api/endpoints.md) — 后端 API 接口说明
- [部署指南](./deployment.md) — Web 端和桌面端部署
- [开发扩展指南](./extend-diagram.md) — 如何添加新功能
