# 数据管理

本文档说明应用的所有持久化数据、存储位置、以及各清理操作的影响范围。

---

## 数据文件清单

| # | 文件 | 说明 | 可否删除 |
|---|------|------|---------|
| 1 | `data/ai-sketch.db` | SQLite 数据库（全部业务数据） | 是，删除后自动重建空库 |
| 2 | `data/ai-sketch.db.key` | AES-256-GCM 加密密钥（用于加密 API Key） | 仅卸载时随数据库一起删除 |
| 3 | `window-state.json` | 窗口位置、大小、最大化状态 | 是，删除后恢复默认 1200x800 |
| 4 | 更新缓存目录 | electron-updater 下载的更新包 | 是，下次检查更新时重新下载 |

## 各平台存储路径

| 平台 | 数据根目录 |
|------|-----------|
| Windows | `%APPDATA%\ai-sketch\` |
| macOS | `~/Library/Application Support/ai-sketch/` |
| Linux | `~/.config/ai-sketch/` |

具体路径：

```
{数据根目录}/
├── data/
│   ├── ai-sketch.db          # 数据库
│   └── ai-sketch.db.key      # 加密密钥
└── window-state.json          # 窗口状态
```

更新缓存位于 `%LOCALAPPDATA%\ai-sketch\`（Windows）。

## 数据库表结构

| 表 | 内容 | key 示例 |
|----|------|---------|
| `llm_configs` | LLM 提供商配置 | — |
| `meta` | 全局设置键值对 | `active_config_id`、`proxy_url`、`proxy_enabled`、`llm_max_retries`、`preference_locale`、`preference_theme`、`preference_glow_enabled` |
| `conversations` | 对话记录 | — |
| `messages` | 对话消息 | — |
| `response_cache` | AI 响应缓存（L2 持久层，100MB 上限，可配置 TTL） | — |

## 设置页面清理操作

### 重置偏好设置

| 操作 | 影响范围 |
|------|---------|
| 删除 | meta 表：`preference_locale` → `zh`、`preference_theme` → `light`、`preference_glow_enabled` → `false` |
| 保留 | 对话、配置、缓存、代理、重试次数、窗口状态、加密密钥 |

### 清除对话

| 操作 | 影响范围 |
|------|---------|
| 删除 | `conversations` 表（全部）、`messages` 表（全部） |
| 保留 | 配置、缓存、偏好设置、代理、重试次数、窗口状态、加密密钥 |

### 清除配置

| 操作 | 影响范围 |
|------|---------|
| 删除 | `llm_configs` 表（全部）、meta 表 `active_config_id` |
| 保留 | 对话、缓存、偏好设置、代理、重试次数、窗口状态、加密密钥文件 |

### 清除缓存

| 操作 | 影响范围 |
|------|---------|
| 删除 | `response_cache` 表（全部） |
| 保留 | 对话、配置、偏好设置、代理、重试次数、窗口状态、加密密钥 |

### 重置全部

| 操作 | 影响范围 |
|------|---------|
| 删除 | meta 表（全部）+ 对话 + 配置 + 缓存 + `window-state.json` |
| 保留 | 数据库文件、加密密钥文件 |

重置后应用等同于全新安装状态（数据库为空，窗口恢复默认尺寸）。

## 卸载应用

NSIS 卸载脚本会询问用户是否删除应用数据。

**选择"是"** — 删除以下目录：

- `%APPDATA%\ai-sketch\`（数据库 + 密钥文件 + 窗口状态）
- `%LOCALAPPDATA%\ai-sketch\`（更新缓存）

**选择"否"** — 仅卸载程序，保留全部数据。重新安装后数据自动恢复。

## 设计原则

1. **密钥文件仅卸载时删除** — `ai-sketch.db.key` 与数据库配对，数据库存在时必须保留密钥，否则已加密的 API Key 无法解密。
2. **重置全部不删除数据库文件** — 只清空表数据，不删除 `.db` 文件本身，避免需要重新初始化 sql.js。
3. **窗口状态可安全删除** — 删除后 `loadWindowState()` 返回默认值，用户移动/调整窗口时自动重建文件。
