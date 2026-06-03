# 光晕背景效果设计文档

## 概述

将 website 子项目中的光晕背景效果封装并应用到主项目，扩展现有的 blur-orb 系统，支持多主题适配和用户开关控制。

## 背景

website 子项目实现了一套精美的光晕背景效果：
- 4 个 fixed 定位的大面积模糊圆形（120-150px blur）
- 交错的 opacity 脉冲动画
- 浮动的小粒子装饰
- 紫蓝粉渐变配色

主项目已有 `blur-orb` 系统，但实现方式不同：
- absolute 定位（随滚动移动）
- 80px blur
- 缩放浮动动画
- 单色配色

## 设计目标

1. 复用现有 blur-orb 系统，避免代码重复
2. 支持 6 种主题，每种主题使用对比色光晕
3. 提供用户开关，可关闭光晕效果
4. 应用到所有页面

---

## 技术设计

### 1. CSS 扩展

#### 1.1 主题光晕颜色变量

每个主题定义 4 个光晕颜色变量，与背景色形成对比：

| 主题 | 背景色 | 光晕 1 | 光晕 2 | 光晕 3 | 光晕 4 |
|------|--------|--------|--------|--------|--------|
| default | #FAF8F5 暖白 | 紫色 #c4b5fd | 蓝色 #93c5fd | 粉色 #f9a8d4 | 靛蓝 #a5b4fc |
| dark | #eef2ff 浅靛蓝 | 琥珀 #fcd34d | 玫瑰 #fda4af | 翠绿 #6ee7b7 | 天蓝 #7dd3fc |
| ocean | #e0f2fe 浅蓝 | 琥珀 #fcd34d | 粉色 #f9a8d4 | 紫色 #c4b5fd | 翠绿 #a7f3d0 |
| sakura | #fce7f3 浅粉 | 靛蓝 #a5b4fc | 天蓝 #7dd3fc | 琥珀 #fcd34d | 翠绿 #6ee7b7 |
| emerald | #d1fae5 浅绿 | 玫瑰 #fda4af | 紫色 #c4b5fd | 琥珀 #fcd34d | 天蓝 #7dd3fc |
| sunset | #fff7ed 浅橙 | 靛蓝 #a5b4fc | 翠绿 #6ee7b7 | 粉色 #f9a8d4 | 天蓝 #7dd3fc |

**设计原则**：暖色背景 → 冷色光晕，冷色背景 → 暖色光晕，保持低饱和度。

#### 1.2 新增动画

```css
/* 柔和脉冲 - opacity 变化 */
@keyframes pulse-soft {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}

.animate-pulse-soft {
  animation: pulse-soft 4s ease-in-out infinite;
}

/* 浮动粒子 */
@keyframes float-particle {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.animate-float-particle {
  animation: float-particle 6s ease-in-out infinite;
}
```

#### 1.3 扩展 blur-orb 类

```css
/* fixed 定位模式 - 全局背景光晕 */
.blur-orb-fixed {
  position: fixed;
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  z-index: 0;
}

/* 光晕颜色变体 */
.blur-orb-glow-1 { background: var(--glow-1); opacity: 0.15; }
.blur-orb-glow-2 { background: var(--glow-2); opacity: 0.12; }
.blur-orb-glow-3 { background: var(--glow-3); opacity: 0.10; }
.blur-orb-glow-4 { background: var(--glow-4); opacity: 0.08; }
```

---

### 2. 组件设计

#### 2.1 GlowBackground 组件

文件：`components/ui/GlowBackground.tsx`

**职责**：
- 渲染全局光晕背景
- 读取用户设置，控制显示/隐藏
- 使用 fixed 定位，不随滚动移动

**结构**：
```
GlowBackground
├── 4 个 blur-orb-fixed 元素（大面积光晕）
│   ├── 紫色系 600px，左上 10%
│   ├── 蓝色系 500px，右中 40%
│   ├── 粉色系 400px，左下 10%
│   └── 靛蓝系 350px，左下 60%
└── 5 个浮动粒子元素
    ├── 12px 圆点
    ├── 8px 圆点
    ├── 16px 圆点
    ├── 8px 圆点
    └── 12px 圆点
```

**动画配置**：
- 光晕：`animate-pulse-soft`，交错延迟 0s/2s/4s
- 粒子：`animate-float-particle`，交错延迟 0s/1s/2s/3s/1.5s

---

### 3. 状态管理

#### 3.1 useSettings hook 扩展

添加 `glowEnabled` 状态：

```typescript
interface Settings {
  // 现有设置...
  glowEnabled: boolean;
}

const defaultSettings: Settings = {
  // 现有默认值...
  glowEnabled: true, // 默认开启
};
```

持久化到 localStorage，key 为 `ai-sketch-settings`。

---

### 4. 页面集成

#### 4.1 全局布局

在 `app/layout.tsx` 中集成：

```tsx
<ClientProviders>
  <GlowBackground />
  {children}
</ClientProviders>
```

#### 4.2 首页清理

移除 `app/page.tsx` 中的内联光晕代码（第 89-94 行），避免重复：

```diff
- <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
-   <div className="blur-orb blur-orb-indigo" style={{ ... }} />
-   <div className="blur-orb blur-orb-violet" style={{ ... }} />
-   <div className="blur-orb blur-orb-cyan" style={{ ... }} />
- </div>
```

#### 4.3 设置页面

在 `app/settings/page.tsx` 添加开关：

```tsx
<div className="flex items-center justify-between">
  <div>
    <p className="font-medium">光晕背景效果</p>
    <p className="text-sm text-[var(--muted)]">页面背景的动态光晕装饰</p>
  </div>
  <Switch
    checked={settings.glowEnabled}
    onCheckedChange={(checked) => updateSettings({ glowEnabled: checked })}
  />
</div>
```

---

## 文件改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `app/globals.css` | 修改 | 添加光晕变量、动画、扩展 blur-orb 类 |
| `components/ui/GlowBackground.tsx` | 新建 | 全局光晕背景组件 |
| `app/layout.tsx` | 修改 | 集成 GlowBackground 组件 |
| `app/page.tsx` | 修改 | 移除首页内联光晕（避免重复） |
| `hooks/useSettings.ts` | 修改 | 添加 glowEnabled 状态 |
| `app/settings/page.tsx` | 修改 | 添加光晕开关 UI |

---

## 实现顺序

1. **CSS 基础**：globals.css 添加变量、动画、类
2. **组件开发**：创建 GlowBackground.tsx
3. **设置集成**：useSettings 添加状态
4. **页面集成**：layout.tsx、page.tsx、settings/page.tsx
5. **测试验证**：各主题可见性、开关功能、性能

---

## 注意事项

1. **z-index 层级**：光晕背景 `z-0`，内容 `z-10`
2. **性能优化**：`pointer-events: none` 确保不阻挡交互
3. **无障碍**：`aria-hidden="true"` 标记装饰元素
4. **主题切换**：CSS 变量自动响应主题变化，无需额外处理
