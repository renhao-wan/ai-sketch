# AI Sketch

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-Apache--2.0-green)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-28-47848f?logo=electron&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind--CSS-4-06b6d4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite(sql.js)-WASM-003B57?logo=sqlite&logoColor=white)
![Excalidraw](https://img.shields.io/badge/Excalidraw-0.18-7B68EE?logo=excalidraw&logoColor=white)
![Mermaid](https://img.shields.io/badge/Mermaid-11-FF6B6B?logo=mermaid&logoColor=white)

</div>

> AI 驱动的图表生成平台 — 用自然语言描述，AI 帮你画图

AI Sketch 是一个基于 LLM 的图表生成 Web 应用，支持通过自然语言描述生成可渲染的图表代码。支持 Excalidraw、Mermaid、Draw.io 三种图表格式，提供实时流式生成、多轮对话、代码编辑等功能。

## ✨ 功能特性

- 🤖 **AI 图表生成** — 通过自然语言描述生成流程图、架构图、ER 图、时序图等 22 种图表类型
- 🎨 **多格式支持** — Excalidraw JSON、Mermaid、Draw.io XML 三种输出格式
- ⚡ **流式生成** — SSE 实时流式返回，边生成边渲染
- 💬 **多轮对话** — 支持上下文感知的连续对话，逐步完善图表
- 📝 **代码编辑** — 内置 Monaco Editor，支持直接编辑生成的代码
- 🖼️ **图片识别** — 支持上传图片，AI 自动转换为图表代码
- 🌐 **国际化** — 支持中文和英文界面
- 🖥️ **桌面应用** — 基于 Electron 的跨平台桌面客户端（Windows/macOS/Linux）

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 10+

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/ai-sketch.git
cd ai-sketch

# 安装依赖
pnpm install
```

### 配置 LLM

首次启动后，进入设置页面（`/settings`）配置 LLM 服务：

- **OpenAI 兼容接口** — 支持任意 OpenAI API 兼容的服务商（如 DeepSeek、Moonshot、Ollama 等）
- **Anthropic API** — 支持 Claude 系列模型

配置项包括：
- API Base URL
- API Key
- 模型名称

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000 即可使用。

### 启动 Electron 桌面应用

```bash
pnpm electron:dev
```

## 📦 构建与打包

### Web 端构建

```bash
pnpm build
pnpm start  # 启动生产服务器
```

### Electron 桌面应用打包

```bash
pnpm electron:build
```

打包产物输出到 `dist/` 目录：
- Windows: `AI Sketch Setup x.x.x.exe`（NSIS 安装包）
- macOS: `AI Sketch-x.x.x.dmg`
- Linux: `AI Sketch-x.x.x.AppImage`

## 🏗️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router）+ React 19 |
| 语言 | TypeScript 5.9（strict 模式） |
| 样式 | Tailwind CSS v4（CSS-first 配置） |
| 数据库 | SQLite via sql.js（WASM） |
| 图表渲染 | Excalidraw、Mermaid、Draw.io |
| 代码编辑 | Monaco Editor |
| 桌面端 | Electron 28 + electron-builder |
| 图标 | lucide-react |

## 📁 项目结构

```
ai-sketch/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由
│   │   ├── generate/             # 核心 SSE 流式生成
│   │   ├── conversations/        # 对话 CRUD
│   │   ├── configs/              # LLM 配置管理
│   │   └── models/               # 模型列表
│   ├── editor/                   # 主编辑器页面
│   ├── settings/                 # 设置页面
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 首页
│   └── globals.css               # 全局样式 + 主题系统
├── components/                   # React 组件
│   ├── ai/                       # AI 副驾驶面板
│   ├── canvases/                 # 图表画布（Excalidraw/Mermaid/Draw.io）
│   ├── editor/                   # 代码编辑器相关
│   ├── layout/                   # 布局组件
│   ├── settings/                 # 设置页面组件
│   └── ui/                       # 通用 UI 组件
├── lib/                          # 核心库
│   ├── api/                      # 客户端 API 封装
│   ├── db/                       # SQLite 数据库
│   ├── diagram/                  # 图表处理工具
│   ├── input-strategies/         # 输入类型策略模式
│   ├── llm/                      # LLM 客户端
│   ├── locales/                  # 国际化
│   ├── prompts/                  # LLM 提示词
│   ├── strategies/               # 图表格式策略模式
│   ├── types/                    # TypeScript 类型定义
│   └── utils/                    # 工具函数
├── hooks/                        # React Hooks
├── electron/                     # Electron 桌面应用
│   ├── main.ts                   # 主进程
│   ├── preload.ts                # 预加载脚本
│   └── server.ts                 # 嵌入式 Next.js 服务器
├── docs/                         # 项目文档
├── scripts/                      # 构建脚本
└── types/                        # 全局类型声明
```

## 🔧 常用命令

```bash
# 开发
pnpm dev              # 启动 Web 开发服务器
pnpm electron:dev     # 启动 Electron 开发模式

# 构建
pnpm build            # 构建 Next.js 应用
pnpm electron:build   # 打包 Electron 桌面应用

# 代码质量
pnpm lint             # ESLint 检查

# 生产运行
pnpm start            # 启动生产服务器
```

## 📚 文档

### 架构文档
- [架构概览](docs/architecture/overview.md) — 整体架构设计、核心模块、数据流
- [图表格式策略模式](docs/architecture/diagram-strategy.md) — DiagramStrategy 接口详解
- [输入类型策略模式](docs/architecture/input-strategy.md) — InputStrategy 接口详解

### API 文档
- [API 接口文档](docs/api/endpoints.md) — 后端 API 接口详细说明

### 开发指南
- [开发扩展指南](docs/guides/extend-diagram.md) — 如何添加新图表格式、新输入类型
- [部署指南](docs/guides/deployment.md) — Web 端和 Electron 端部署说明

### 图表文档
- [箭头计算规则](docs/diagram/arrow-compute-rule.md) — Excalidraw 箭头对齐算法
- [Excalidraw API 参考](docs/diagram/excalidraw-doc.md) — 元素编程创建指南

### Electron 文档
- [Electron 开发指南](docs/electron/electron.md) — 桌面应用开发说明
- [Electron 测试报告](docs/electron/electron-test-report.md) — 测试结果和问题修复

## 🎨 主题系统

内置 6 套主题，可在设置页面切换：

| 主题 | 色调 |
|------|------|
| 默认 | 暖象牙色 |
| 暗夜 | 深靛蓝 |
| 海洋 | 蓝绿色 |
| 樱花 | 粉色 |
| 翡翠 | 绿色 |
| 日落 | 橙色 |

## 🤝 贡献

欢迎贡献代码！请遵循以下规范：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

### 提交规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <subject>

# 示例
feat(editor): 添加代码折叠功能
fix(api): 修复流式响应中断问题
docs(readme): 更新安装说明
```

## 📄 许可证

[Apache-2.0 License](LICENSE)

## 🙏 致谢

- [Excalidraw](https://excalidraw.com/) — 手绘风格图表库
- [Mermaid](https://mermaid.js.org/) — Markdown 图表渲染引擎
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — 代码编辑器
- [Next.js](https://nextjs.org/) — React 框架
- [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
