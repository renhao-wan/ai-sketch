# 新手引导功能设计文档

**日期：** 2026-06-17
**状态：** 已批准
**作者：** Claude Code

---

## 概述

为 ai-sketch 应用添加新手引导功能，帮助首次使用的用户快速了解产品核心功能和交互方式。

### 核心需求

1. 首次打开时显示欢迎弹窗，用户可选择"快速引导"、"完整引导"或"跳过"
2. 快速引导（core 模式）：介绍核心流程，约 2 分钟
3. 完整引导（full 模式）：分组介绍所有功能，约 5 分钟
4. 引导状态存储在数据库中，完成后不再自动触发
5. 设置页面提供"重新查看完整引导"入口

---

## 架构设计

### 组件结构

```
components/
  onboarding/
    OnboardingProvider.tsx    # Context Provider + 状态管理
    OnboardingOverlay.tsx     # 遮罩 + 高亮 + 提示框
    WelcomeModal.tsx          # 首次欢迎弹窗（模式选择）
    useOnboarding.ts          # Hook，供页面注册步骤
lib/
  db/
    onboarding-manager.ts     # 数据库操作（读写引导状态）
  locales/
    zh.ts                     # 新增引导相关翻译
    en.ts
```

### 数据流

```
用户打开应用
      ↓
OnboardingProvider 初始化
      ↓
从数据库读取 onboarding_completed 状态
      ↓
┌─────────────────────────────────────┐
│ 无记录 → 显示 WelcomeModal          │
│ 有记录 → 不触发引导                  │
└─────────────────────────────────────┘
      ↓
用户选择模式（core / full / skip）
      ↓
OnboardingOverlay 渲染
      ↓
逐步高亮目标区域 + 显示提示框
      ↓
完成 → 写入数据库标记
```

---

## 组件设计

### 1. OnboardingProvider

Context Provider，管理引导全局状态。

```typescript
interface OnboardingState {
  isActive: boolean;           // 引导是否激活
  currentStep: number;         // 当前步骤索引
  steps: OnboardingStep[];     // 步骤列表
  mode: 'core' | 'full';      // 引导模式
}

interface OnboardingContextValue extends OnboardingState {
  startOnboarding: (mode: 'core' | 'full') => void;
  nextStep: () => void;
  prevStep: () => void;
  skip: () => void;
  finish: () => void;
}
```

**职责：**
- 管理引导状态（当前步骤、激活状态、步骤列表）
- 提供 `nextStep()`、`prevStep()`、`skip()`、`finish()` 等方法
- 从数据库读取/写入引导完成状态
- 监听路由变化，自动处理跨页面步骤

### 2. OnboardingOverlay

覆盖层组件，渲染遮罩、高亮区域和提示框。

**功能：**
- 渲染半透明遮罩（rgba(0,0,0,0.5)）
- 计算目标元素位置，渲染高亮区域（无遮罩，圆角边框 + 阴影）
- 渲染提示框（毛玻璃风格），包含标题、说明文字、导航按钮
- 提示框带箭头指向目标区域
- 底部显示步骤进度（如 "3/15"）

**边界处理：**
- 目标元素不存在时跳过该步骤，显示提示
- 窗口 resize 时重新计算位置
- 目标元素在可视区域外时自动滚动

### 3. WelcomeModal

首次打开时的欢迎弹窗。

**内容：**
- 欢迎标题："欢迎使用 AI Sketch！"
- 副标题："选择引导模式，快速上手"
- 两个选项卡片：
  - 快速引导：介绍核心流程，约 2 分钟
  - 完整引导：介绍所有功能，约 5 分钟
- 底部："跳过，直接开始"链接

---

## 步骤定义

### 步骤数据结构

```typescript
interface OnboardingStep {
  id: string;                    // 步骤唯一标识
  target: string;                // CSS 选择器，高亮目标元素
  title: string;                 // 提示框标题（国际化 key）
  content: string;               // 提示框内容（国际化 key）
  placement: 'top' | 'bottom' | 'left' | 'right';  // 提示框位置
  group?: string;                // 分组标识（full 模式用）
  mode: 'core' | 'full';        // 属于哪个模式
}
```

### 核心流程步骤（core 模式，6 步）

| 序号 | ID | 目标 | 标题 | 位置 |
|------|-----|------|------|------|
| 1 | `home-input` | `#ai-prompt-box` | 输入描述 | bottom |
| 2 | `home-generate` | `#generate-button` | 生成按钮 | bottom |
| 3 | `editor-chat` | `#chat-input` | AI 对话区 | right |
| 4 | `editor-canvas` | `#diagram-canvas` | 画布区域 | left |
| 5 | `editor-code` | `#code-editor` | 代码编辑器 | top |
| 6 | `editor-back` | `#back-to-home` | 返回首页 | bottom |

### 完整流程步骤（full 模式，约 18 步）

分组进行，每组结束后显示分组标题过渡：

| 分组 | 步骤 |
|------|------|
| **首页** | 输入框、生成按钮 |
| **AI 对话区** | 格式选择、图表类型、生成模式、上下文开关、发送按钮 |
| **画布操作区** | 缩放工具栏、右键菜单 |
| **代码编辑区** | Monaco Editor 区域 |
| **工具栏区** | 布局、美化、简化、解释 4 个按钮 |
| **顶部栏** | 导出、版本历史、返回首页 |

---

## 数据库存储

### 存储方式

使用现有的 `meta` 表存储引导状态：

| key | value | 说明 |
|-----|-------|------|
| `onboarding_completed` | `"core"` / `"full"` / `"skipped"` | 引导完成状态 |
| `onboarding_completed_at` | ISO 时间戳 | 完成时间 |

**设计决策：**
- 使用 meta 表而非新建表，因为引导状态是简单的 KV 数据
- 复用现有 `ConfigManager` 的读写逻辑
- 避免增加数据库迁移复杂度

### OnboardingManager

```typescript
class OnboardingManager {
  // 获取引导状态
  async getStatus(): Promise<string | null>
  
  // 设置引导状态
  async setStatus(status: 'core' | 'full' | 'skipped'): Promise<void>
  
  // 检查是否已完成引导
  async isCompleted(): Promise<boolean>
}
```

---

## 国际化

### 翻译结构

```typescript
{
  onboarding: {
    welcome: {
      title: '欢迎使用 AI Sketch！',
      subtitle: '选择引导模式，快速上手',
      core: '快速引导',
      coreDesc: '介绍核心流程，约 2 分钟',
      full: '完整引导',
      fullDesc: '介绍所有功能，约 5 分钟',
      skip: '跳过，直接开始'
    },
    step: {
      prev: '上一步',
      next: '下一步',
      finish: '完成',
      skip: '跳过引导',
      progress: '{current}/{total}'
    },
    steps: {
      'home-input': {
        title: '输入描述',
        content: '在这里输入你想要生成的图表描述...'
      },
      // ... 更多步骤
    },
    groups: {
      'ai-chat': 'AI 对话区',
      'canvas': '画布操作区',
      'code-editor': '代码编辑区',
      'toolbar': '工具栏区',
      'top-bar': '顶部栏'
    }
  }
}
```

---

## 触发时机

| 场景 | 行为 |
|------|------|
| 首次打开应用（数据库无记录） | 显示欢迎弹窗，用户选择模式 |
| 已完成引导（数据库有记录） | 不触发，直接进入应用 |
| 设置页面点击"重新查看" | 触发 full 模式引导 |
| 用户跳过引导 | 标记为 `skipped`，下次不再触发 |

### 路由切换处理

- 引导状态存储在 Context 中，跨路由保持
- 首页引导完成 → 自动跳转到编辑器 → 继续编辑器引导
- 路由切换时，`OnboardingProvider` 检测目标步骤是否在当前页面
- 如果目标步骤在其他页面，先完成路由跳转，再渲染高亮

---

## 边界情况处理

| 情况 | 处理方式 |
|------|---------|
| 目标元素不存在 | 跳过该步骤，显示提示"该功能需要先完成 XX 配置" |
| 窗口 resize | 重新计算高亮位置和提示框位置 |
| 目标元素在可视区域外 | 自动滚动到目标元素 |
| 用户在引导过程中刷新页面 | 从数据库读取状态，询问是否继续 |
| 移动端/小屏幕 | 提示框改为居中显示，高亮区域自适应 |

---

## 样式规范

### 高亮区域

- 目标元素周围无遮罩
- 圆角边框（8px）
- 轻微阴影（box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5)）
- 动画：淡入效果

### 提示框

- 毛玻璃风格（backdrop-filter: blur(12px)）
- 背景色：与现有 Modal 组件一致
- 带箭头指向目标区域
- 最大宽度：320px
- 包含：标题、说明文字、导航按钮、步骤进度

### 遮罩

- 半透明黑色（rgba(0,0,0,0.5)）
- 点击遮罩不关闭引导（防止误操作）

---

## 设置页面入口

在设置页面的 **"关于"** tab 中添加：

```tsx
<div className="mt-6">
  <h3>引导与帮助</h3>
  <Button onClick={() => startOnboarding('full')}>
    重新查看完整引导
  </Button>
</div>
```

---

## 实现优先级

1. **P0 - 核心功能**
   - OnboardingProvider + 状态管理
   - OnboardingOverlay（遮罩 + 高亮 + 提示框）
   - WelcomeModal
   - 数据库存储
   - 核心流程步骤（core 模式）

2. **P1 - 完整功能**
   - 完整流程步骤（full 模式）
   - 分组介绍
   - 设置页面入口
   - 国际化

3. **P2 - 优化体验**
   - 自动滚动
   - 响应式适配
   - 动画优化
   - 边界情况完善

---

## 技术约束

- 使用现有的 React Context + hooks 架构
- 样式与现有毛玻璃风格保持一致
- 支持国际化（中英文）
- 不引入新的第三方依赖
- 数据库操作复用现有 ConfigManager 模式
