# 光晕背景效果实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 website 子项目的光晕背景效果封装并应用到主项目，扩展现有 blur-orb 系统，支持多主题适配和用户开关控制。

**Architecture:** 扩展现有 CSS blur-orb 系统，添加 fixed 定位模式和 pulse-soft 动画；创建 GlowBackground 组件渲染全局光晕；通过 useSettings hook 管理开关状态；在全局布局中集成组件。

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, CSS Custom Properties

---

## 文件结构

### 新建文件
- `components/ui/GlowBackground.tsx` — 全局光晕背景组件

### 修改文件
- `app/globals.css` — 添加光晕变量、动画、扩展 blur-orb 类
- `hooks/useSettings.ts` — 添加 glowEnabled 状态
- `app/layout.tsx` — 集成 GlowBackground 组件
- `app/page.tsx` — 移除首页内联光晕（避免重复）
- `app/settings/page.tsx` — 添加光晕开关 UI
- `components/settings/AppearanceSettings.tsx` — 添加光晕开关到外观设置

---

## Task 1: CSS 基础 — 添加光晕变量和动画

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: 添加主题光晕颜色变量**

在 `globals.css` 的 `:root` 中添加光晕颜色变量：

```css
:root {
  /* 现有变量... */

  /* 光晕颜色 - 与背景色形成对比 */
  --glow-1: #c4b5fd; /* 紫色系 */
  --glow-2: #93c5fd; /* 蓝色系 */
  --glow-3: #f9a8d4; /* 粉色系 */
  --glow-4: #a5b4fc; /* 靛蓝系 */
}
```

- [ ] **Step 2: 添加各主题光晕颜色变量**

在 `globals.css` 的各主题中添加对应的光晕颜色：

```css
/* dark 主题 - 浅靛蓝背景 */
[data-theme="dark"] {
  /* 现有变量... */

  --glow-1: #fcd34d; /* 琥珀色 */
  --glow-2: #fda4af; /* 玫瑰色 */
  --glow-3: #6ee7b7; /* 翠绿色 */
  --glow-4: #7dd3fc; /* 天蓝色 */
}

/* ocean 主题 - 浅蓝背景 */
[data-theme="ocean"] {
  /* 现有变量... */

  --glow-1: #fcd34d; /* 琥珀色 */
  --glow-2: #f9a8d4; /* 粉色 */
  --glow-3: #c4b5fd; /* 紫色 */
  --glow-4: #a7f3d0; /* 翠绿色 */
}

/* sakura 主题 - 浅粉背景 */
[data-theme="sakura"] {
  /* 现有变量... */

  --glow-1: #a5b4fc; /* 靛蓝色 */
  --glow-2: #7dd3fc; /* 天蓝色 */
  --glow-3: #fcd34d; /* 琥珀色 */
  --glow-4: #6ee7b7; /* 翠绿色 */
}

/* emerald 主题 - 浅绿背景 */
[data-theme="emerald"] {
  /* 现有变量... */

  --glow-1: #fda4af; /* 玫瑰色 */
  --glow-2: #c4b5fd; /* 紫色 */
  --glow-3: #fcd34d; /* 琥珀色 */
  --glow-4: #7dd3fc; /* 天蓝色 */
}

/* sunset 主题 - 浅橙背景 */
[data-theme="sunset"] {
  /* 现有变量... */

  --glow-1: #a5b4fc; /* 靛蓝色 */
  --glow-2: #6ee7b7; /* 翠绿色 */
  --glow-3: #f9a8d4; /* 粉色 */
  --glow-4: #7dd3fc; /* 天蓝色 */
}
```

- [ ] **Step 3: 添加 pulse-soft 动画**

在 `globals.css` 的 Animation Keyframes 部分添加：

```css
@keyframes pulse-soft {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}
```

- [ ] **Step 4: 添加 float-particle 动画**

在 `globals.css` 的 Animation Keyframes 部分添加：

```css
@keyframes float-particle {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
```

- [ ] **Step 5: 添加动画工具类**

在 `globals.css` 的 Animation Utilities 部分添加：

```css
.animate-pulse-soft {
  animation: pulse-soft 4s ease-in-out infinite;
}

.animate-float-particle {
  animation: float-particle 6s ease-in-out infinite;
}
```

- [ ] **Step 6: 扩展 blur-orb 类**

在 `globals.css` 的 Blur Orb Background Decorations 部分添加：

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
.blur-orb-glow-1 {
  background: var(--glow-1);
  opacity: 0.15;
}

.blur-orb-glow-2 {
  background: var(--glow-2);
  opacity: 0.12;
}

.blur-orb-glow-3 {
  background: var(--glow-3);
  opacity: 0.10;
}

.blur-orb-glow-4 {
  background: var(--glow-4);
  opacity: 0.08;
}
```

- [ ] **Step 7: 提交 CSS 基础改动**

```bash
git add app/globals.css
git commit -m "feat(glow): 添加光晕效果 CSS 基础 - 变量、动画、类"
```

---

## Task 2: 状态管理 — 扩展 useSettings hook

**Files:**
- Modify: `hooks/useSettings.ts`

- [ ] **Step 1: 添加 glowEnabled 到 Settings 接口**

在 `hooks/useSettings.ts` 中修改 Settings 接口：

```typescript
export interface Settings {
  locale: 'zh' | 'en';
  theme: Theme;
  glowEnabled: boolean;
}
```

- [ ] **Step 2: 添加默认值和存储 key**

在 `hooks/useSettings.ts` 中修改默认值和存储 key：

```typescript
const DEFAULT_SETTINGS: Settings = {
  locale: 'zh',
  theme: 'light',
  glowEnabled: true,
};

const STORAGE_KEYS = {
  locale: 'ai-sketch-locale',
  theme: 'ai-sketch-theme',
  glowEnabled: 'ai-sketch-glow-enabled',
} as const;
```

- [ ] **Step 3: 添加验证函数**

在 `hooks/useSettings.ts` 中添加验证函数：

```typescript
function isValidGlowEnabled(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
```

- [ ] **Step 4: 修改 useEffect 读取逻辑**

在 `hooks/useSettings.ts` 中修改 useEffect：

```typescript
useEffect(() => {
  const locale = getStoredValue(STORAGE_KEYS.locale, DEFAULT_SETTINGS.locale, isValidLocale);
  const theme = getStoredValue(STORAGE_KEYS.theme, DEFAULT_SETTINGS.theme, isValidTheme);
  const glowEnabled = getStoredValue(STORAGE_KEYS.glowEnabled, DEFAULT_SETTINGS.glowEnabled, isValidGlowEnabled);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 从 localStorage 同步初始设置，仅执行一次
  setSettings(prev => {
    if (prev.locale === locale && prev.theme === theme && prev.glowEnabled === glowEnabled) return prev;
    return { locale, theme, glowEnabled };
  });
}, []);
```

- [ ] **Step 5: 提交 useSettings 改动**

```bash
git add hooks/useSettings.ts
git commit -m "feat(glow): 扩展 useSettings hook 添加 glowEnabled 状态"
```

---

## Task 3: 组件开发 — 创建 GlowBackground 组件

**Files:**
- Create: `components/ui/GlowBackground.tsx`

- [ ] **Step 1: 创建 GlowBackground 组件**

创建 `components/ui/GlowBackground.tsx`：

```tsx
'use client';

import { useSettings } from '@/hooks/useSettings';

interface GlowOrb {
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  colorClass: string;
  delay?: number;
}

interface GlowParticle {
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  colorClass: string;
  delay?: number;
}

const orbs: GlowOrb[] = [
  { size: 600, top: '10%', left: '10%', colorClass: 'blur-orb-glow-1' },
  { size: 500, top: '40%', right: '5%', colorClass: 'blur-orb-glow-2', delay: 2 },
  { size: 400, bottom: '10%', left: '30%', colorClass: 'blur-orb-glow-3', delay: 4 },
  { size: 350, top: '60%', left: '5%', colorClass: 'blur-orb-glow-4' },
];

const particles: GlowParticle[] = [
  { size: 12, top: '15%', left: '8%', colorClass: 'bg-[var(--glow-1)]' },
  { size: 8, top: '25%', right: '12%', colorClass: 'bg-[var(--glow-2)]', delay: 1 },
  { size: 16, top: '50%', left: '15%', colorClass: 'bg-[var(--glow-3)]', delay: 2 },
  { size: 8, top: '70%', right: '20%', colorClass: 'bg-[var(--glow-4)]', delay: 3 },
  { size: 12, bottom: '20%', left: '25%', colorClass: 'bg-[var(--glow-1)]', delay: 1.5 },
];

export default function GlowBackground() {
  const { settings } = useSettings();

  if (!settings.glowEnabled) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 大面积光晕 */}
      {orbs.map((orb, i) => (
        <div
          key={`orb-${i}`}
          className={`blur-orb-fixed ${orb.colorClass} animate-pulse-soft`}
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            right: orb.right,
            bottom: orb.bottom,
            animationDelay: orb.delay ? `${orb.delay}s` : undefined,
          }}
        />
      ))}

      {/* 浮动粒子 */}
      {particles.map((p, i) => (
        <div
          key={`particle-${i}`}
          className={`absolute rounded-full ${p.colorClass} animate-float-particle opacity-40`}
          style={{
            width: p.size,
            height: p.size,
            top: p.top,
            left: p.left,
            right: p.right,
            bottom: p.bottom,
            animationDelay: p.delay ? `${p.delay}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 提交 GlowBackground 组件**

```bash
git add components/ui/GlowBackground.tsx
git commit -m "feat(glow): 创建 GlowBackground 全局光晕背景组件"
```

---

## Task 4: 页面集成 — 全局布局和首页清理

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: 在 layout.tsx 中集成 GlowBackground**

修改 `app/layout.tsx`，导入并添加 GlowBackground 组件：

```tsx
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/layout/ClientProviders";
import GlowBackground from "@/components/ui/GlowBackground";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Sketch - AI 驱动的图表创作平台",
  description: "用自然语言设计专业图表，AI 即时生成流程图、架构图、思维导图等 20+ 图表类型",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientProviders>
          <GlowBackground />
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: 移除 page.tsx 中的内联光晕**

修改 `app/page.tsx`，移除第 89-94 行的内联光晕代码：

```diff
      {/* Main */}
      <main className="flex-1 flex items-center justify-center relative overflow-hidden">
-       {/* Background orbs */}
-       <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
-         <div className="blur-orb blur-orb-indigo" style={{ width: '600px', height: '600px', top: '-5%', left: '-8%' }} />
-         <div className="blur-orb blur-orb-violet" style={{ width: '500px', height: '500px', top: '25%', right: '-6%', animationDelay: '-7s' }} />
-         <div className="blur-orb blur-orb-cyan" style={{ width: '400px', height: '400px', bottom: '0%', left: '30%', animationDelay: '-13s' }} />
-       </div>

        <div className="relative z-10 w-full max-w-4xl px-6">
```

- [ ] **Step 3: 提交页面集成改动**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat(glow): 集成 GlowBackground 到全局布局，移除首页重复光晕"
```

---

## Task 5: 设置 UI — 添加光晕开关

**Files:**
- Modify: `components/settings/AppearanceSettings.tsx`

- [ ] **Step 1: 读取 AppearanceSettings 组件**

首先读取 `components/settings/AppearanceSettings.tsx` 了解现有结构。

- [ ] **Step 2: 添加光晕开关到外观设置**

在 `components/settings/AppearanceSettings.tsx` 的主题设置之后添加光晕开关：

```tsx
{/* 光晕背景效果 */}
<div className="flex items-center justify-between py-3">
  <div>
    <p className="text-sm font-medium text-[var(--fg)]">
      {t('settings.glowEffect') || '光晕背景效果'}
    </p>
    <p className="text-xs text-[var(--muted)] mt-0.5">
      {t('settings.glowEffectDesc') || '页面背景的动态光晕装饰'}
    </p>
  </div>
  <button
    onClick={() => updateSetting('glowEnabled', !settings.glowEnabled)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
      settings.glowEnabled
        ? 'bg-[var(--accent-indigo)]'
        : 'bg-[var(--border)]'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
        settings.glowEnabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
</div>
```

- [ ] **Step 3: 提交设置 UI 改动**

```bash
git add components/settings/AppearanceSettings.tsx
git commit -m "feat(glow): 在外观设置中添加光晕效果开关"
```

---

## Task 6: 国际化 — 添加翻译键（可选）

**Files:**
- Modify: `lib/locales/zh.ts`
- Modify: `lib/locales/en.ts`

- [ ] **Step 1: 添加中文翻译**

在 `lib/locales/zh.ts` 中添加：

```typescript
'settings.glowEffect': '光晕背景效果',
'settings.glowEffectDesc': '页面背景的动态光晕装饰',
```

- [ ] **Step 2: 添加英文翻译**

在 `lib/locales/en.ts` 中添加：

```typescript
'settings.glowEffect': 'Glow Background Effect',
'settings.glowEffectDesc': 'Dynamic glow decoration on page background',
```

- [ ] **Step 3: 提交翻译改动**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(glow): 添加光晕效果相关翻译键"
```

---

## Task 7: 测试验证

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 验证默认主题光晕效果**

1. 打开浏览器访问首页
2. 确认可以看到紫蓝粉靛四色光晕
3. 确认光晕有脉冲动画效果
4. 确认有浮动小粒子

- [ ] **Step 3: 验证各主题光晕效果**

1. 进入设置页面
2. 切换到各主题（dark/ocean/sakura/emerald/sunset）
3. 确认每个主题的光晕颜色与背景形成对比
4. 确认光晕可见性良好

- [ ] **Step 4: 验证开关功能**

1. 在设置中关闭光晕效果
2. 确认光晕消失
3. 刷新页面，确认设置持久化
4. 重新开启光晕效果

- [ ] **Step 5: 验证全局应用**

1. 访问首页、编辑器、设置等页面
2. 确认所有页面都有光晕效果
3. 确认光晕不阻挡页面交互

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "feat(glow): 完成光晕背景效果功能"
```

---

## 注意事项

1. **z-index 层级**：光晕背景为 `z-0`，内容为 `z-10`
2. **性能优化**：`pointer-events: none` 确保不阻挡交互
3. **无障碍**：`aria-hidden="true"` 标记装饰元素
4. **主题切换**：CSS 变量自动响应主题变化，无需额外处理
5. **避免重复**：首页原有光晕已移除，由全局组件统一管理
