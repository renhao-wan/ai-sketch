# 系统设置中心设计文档

## 概述

将现有的"设置"按钮（仅打开 LLM 配置弹窗）升级为真正的系统设置中心，采用独立页面路由 + 侧边栏导航的经典桌面应用范式。

### 目标

- 提供统一的系统设置入口，替代分散的弹窗式配置
- 迁移 LLM 配置管理到设置页
- 新增外观、编辑器、数据管理等设置分类
- 保持首页历史按钮不变，设置中也提供历史管理

### 非目标

- 不实现用户账号系统
- 不实现云端同步设置
- 不实现快捷键自定义（编辑器设置中仅提供字体大小和自动保存）

---

## 页面结构

### 路由

`/settings` — `app/settings/page.tsx`

### 布局

```
┌─────────────────────────────────────────────────────┐
│  ← 返回首页        系统设置                           │
├───────────┬─────────────────────────────────────────┤
│           │                                         │
│  🎨 外观   │  <h2>当前分类标题</h2>                    │
│           │  <p>分类描述</p>                          │
│  🤖 LLM配置│                                         │
│           │  ┌─────────────────────────────────┐    │
│  ✏️ 编辑器 │  │  具体设置项                      │    │
│           │  │                                 │    │
│  💾 数据管理│  │  设置项: [开关/下拉/输入框/滑块]  │    │
│           │  │                                 │    │
│           │  └─────────────────────────────────┘    │
│           │                                         │
└───────────┴─────────────────────────────────────────┘
```

### 组件结构

```
app/settings/
├── page.tsx                    # 设置页主组件
└── components/
    ├── SettingsSidebar.tsx     # 左侧导航栏
    ├── AppearanceSettings.tsx  # 外观设置
    ├── LLMSettings.tsx         # LLM 配置
    ├── EditorSettings.tsx      # 编辑器设置
    └── DataSettings.tsx        # 数据管理
```

---

## 设置分类详情

### 1. 外观设置

| 设置项 | 类型 | 存储位置 | 默认值 | 说明 |
|--------|------|----------|--------|------|
| 语言 | 下拉选择 | `localStorage('locale')` | `zh` | 中文 / English |
| 主题 | 六选一卡片 | `localStorage('theme')` | `dark` | 深色/浅色/暖色/冷色/森林/薰衣草 |
| 字体大小 | 滑块 | `localStorage('globalFontSize')` | `14` | 范围 12-20px，影响全局 |

#### 主题定义

| 主题 | data-theme 值 | 色调说明 |
|------|---------------|----------|
| 深色 | `dark` | 深灰/黑，当前默认 |
| 浅色 | `light` | 白/浅灰 |
| 暖色 | `warm` | 琥珀/橙色系 |
| 冷色 | `cool` | 蓝/青色系 |
| 森林 | `forest` | 绿色系 |
| 薰衣草 | `lavender` | 紫色系 |

主题切换通过 `document.documentElement.dataset.theme` 控制，每个主题在 `globals.css` 中定义完整的 CSS 变量集。

### 2. LLM 配置

从现有 `ConfigManager.tsx` 迁移，保留全部功能：

| 功能 | 说明 |
|------|------|
| 配置列表 | 搜索、分页、显示名称/类型/模型 |
| 新增配置 | 表单：名称、描述、类型、baseUrl、apiKey、模型 |
| 编辑配置 | 复用新增表单 |
| 克隆配置 | 复制现有配置并重命名 |
| 删除配置 | 需确认对话框 |
| 设为活跃 | 切换当前使用的配置 |
| 测试连接 | 验证 API 连通性 |
| 导入/导出 | JSON 格式的批量导入导出 |

### 3. 编辑器设置

| 设置项 | 类型 | 存储位置 | 默认值 | 说明 |
|--------|------|----------|--------|------|
| 编辑器字体大小 | 滑块 | `localStorage('editorFontSize')` | `14` | 范围 12-20px，影响 Monaco Editor |
| 自动保存 | 开关 | `localStorage('autoSave')` | `true` | 关闭后需手动保存 |
| 画布背景 | 下拉选择 | `localStorage('canvasBg')` | `grid` | 网格 / 点阵 / 纯白 |

### 4. 数据管理

| 功能 | 类型 | 说明 |
|------|------|------|
| 会话历史 | 列表 | 复用 HistoryModal 的搜索、分页、重命名、删除逻辑 |
| 导出所有数据 | 按钮 | 导出 LLM 配置 + 会话历史为 JSON 文件 |
| 导入数据 | 按钮 | 从 JSON 文件导入（合并或覆盖） |
| 清除会话历史 | 按钮 | 需确认对话框，删除所有会话 |
| 存储统计 | 只读 | 显示会话数量、配置数量 |

---

## 数据流与存储

### 存储策略

```
localStorage (浏览器)          SQLite (服务端)
┌─────────────────────┐       ┌─────────────────────┐
│ 外观设置             │       │ LLM 配置             │
│ - locale (zh/en)    │       │ - llm_configs 表     │
│ - theme (6种)       │       │ - activeConfigId     │
│ - globalFontSize    │       │                      │
│                     │       │ 会话历史             │
│ 编辑器设置           │       │ - conversations 表   │
│ - editorFontSize    │       │ - messages 表        │
│ - autoSave (bool)   │       │                      │
│ - canvasBg          │       │                      │
└─────────────────────┘       └─────────────────────┘
```

### API 使用

| 功能 | API 端点 | 方法 |
|------|----------|------|
| 获取配置列表 | `/api/configs` | GET |
| 创建配置 | `/api/configs` | POST |
| 更新配置 | `/api/configs/[id]` | PUT |
| 删除配置 | `/api/configs/[id]` | DELETE |
| 设置活跃配置 | `/api/configs/actions` | POST |
| 克隆配置 | `/api/configs/actions` | POST |
| 导入/导出配置 | `/api/configs/actions` | POST |
| 获取模型列表 | `/api/models` | GET |
| 获取会话列表 | `/api/conversations` | GET |
| 删除会话 | `/api/conversations/[id]` | DELETE |
| 获取会话数量 | `/api/conversations/count` | GET |

### 状态管理

- 外观/编辑器设置：直接读写 `localStorage`，通过 `useSettings` hook 封装
- LLM 配置：通过 `/api/configs` API 管理，组件内 useState
- 会话历史：通过 `/api/conversations` API 管理，组件内 useState

---

## 首页变更

### 当前状态

- 设置按钮（Settings 图标）→ 打开 `ConfigManager` 弹窗
- 历史按钮（History 图标）→ 打开 `HistoryModal` 弹窗

### 变更后

- 设置按钮 → `router.push('/settings')` 跳转设置页
- 历史按钮 → 保持不变，继续打开 `HistoryModal` 弹窗

### 代码变更

```tsx
// app/page.tsx
// 移除:
const [isConfigOpen, setIsConfigOpen] = useState(false);
<ConfigManager isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />

// 修改设置按钮:
<button onClick={() => router.push('/settings')} ...>
  <Settings size={15} />
</button>
```

---

## 组件迁移计划

### ConfigManager.tsx → LLMSettings.tsx

| 来源 | 目标 | 说明 |
|------|------|------|
| 列表视图逻辑 | `LLMSettings.tsx` | 配置卡片列表、搜索、操作按钮 |
| 编辑器视图逻辑 | `LLMSettings.tsx` 内嵌 | 新增/编辑表单 |
| 导入导出逻辑 | `LLMSettings.tsx` | 保留现有实现 |
| 测试连接逻辑 | `LLMSettings.tsx` | 保留现有实现 |

迁移完成后，`components/dialogs/ConfigManager.tsx` 可删除。

### HistoryModal.tsx 复用

- `DataSettings.tsx` 中复用 HistoryModal 的列表+搜索+分页逻辑
- 改为页面内嵌展示，而非弹窗
- 首页 `HistoryModal` 保持不变

---

## 国际化

新增 `settings.*` 命名空间：

```typescript
// locales/zh.ts
settings: {
  title: '系统设置',
  appearance: '外观',
  appearanceDesc: '自定义界面外观',
  language: '语言',
  theme: '主题',
  fontSize: '字体大小',
  themes: {
    dark: '深色',
    light: '浅色',
    warm: '暖色',
    cool: '冷色',
    forest: '森林',
    lavender: '薰衣草',
  },
  llm: 'LLM 配置',
  llmDesc: '管理 AI 模型配置',
  editor: '编辑器',
  editorDesc: '自定义编辑器行为',
  editorFontSize: '编辑器字体大小',
  autoSave: '自动保存',
  autoSaveDesc: '关闭后需手动保存',
  canvasBg: '画布背景',
  canvasBgOptions: {
    grid: '网格',
    dots: '点阵',
    blank: '纯白',
  },
  data: '数据管理',
  dataDesc: '管理会话历史和数据',
  exportAll: '导出所有数据',
  importData: '导入数据',
  clearHistory: '清除会话历史',
  clearHistoryConfirm: '确定要清除所有会话历史吗？此操作不可撤销。',
  storageStats: '存储统计',
  conversations: '会话数量',
  configs: '配置数量',
  back: '返回首页',
}
```

---

## UI 设计规范

### 侧边栏

- 宽度：200px
- 背景：`var(--surface)`
- 选中项：`var(--accent)` 背景 + 白色文字
- 图标：lucide-react（Palette、Bot、Code、Database）

### 内容区

- 左 padding：24px
- 标题：`text-2xl font-semibold`
- 描述：`text-sm text-[var(--muted)]`
- 设置项间距：16px
- 卡片容器：毛玻璃风格，`backdrop-blur-md bg-[var(--surface-glass)]`

### 响应式

- 桌面：侧边栏 + 内容区水平布局
- 移动端：侧边栏折叠为顶部标签栏

---

## 实现顺序

1. **Phase 1：基础框架**
   - 创建 `/settings` 路由和页面组件
   - 实现 `SettingsLayout` 和 `SettingsSidebar`
   - 实现 `AppearanceSettings`（主题切换）

2. **Phase 2：LLM 配置迁移**
   - 将 `ConfigManager` 逻辑迁移到 `LLMSettings`
   - 更新首页设置按钮为路由跳转

3. **Phase 3：编辑器设置**
   - 实现 `EditorSettings`
   - 将设置传递给 Monaco Editor 和画布组件

4. **Phase 4：数据管理**
   - 实现 `DataSettings`
   - 复用 HistoryModal 的列表逻辑
   - 实现导入导出、清除历史功能

5. **Phase 5：收尾**
   - 添加国际化文本
   - 删除旧的 `ConfigManager.tsx`
   - 测试所有功能

---

## 风险与注意事项

1. **主题 CSS 变量完整性**：6 种主题需要定义完整的 CSS 变量集，确保所有组件在各主题下正常显示
2. **编辑器设置实时生效**：字体大小、画布背景等设置变更后需要实时更新，无需刷新页面
3. **数据导出格式**：需要定义统一的导出 JSON 格式，确保导入时能正确解析
4. **移动端适配**：侧边栏在小屏幕下需要折叠或改为其他导航方式
