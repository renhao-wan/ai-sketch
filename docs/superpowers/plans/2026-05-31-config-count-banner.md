# LLM 配置数量软提示实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当 LLM 配置数量 ≥ 15 时，在配置列表顶部显示一个可关闭的毛玻璃风格提示横幅

**Architecture:** 在 ConfigManager 组件中添加 Banner 状态管理逻辑，使用 sessionStorage 存储关闭状态，在配置列表内部顶部渲染提示横幅

**Tech Stack:** React, TypeScript, sessionStorage, lucide-react

---

## 文件结构

- `components/dialogs/ConfigManager.tsx` - 添加 Banner 逻辑和 UI
- `locales/zh.ts` - 添加中文翻译
- `locales/en.ts` - 添加英文翻译

---

### Task 1: 添加国际化翻译

**Files:**
- Modify: `locales/zh.ts`
- Modify: `locales/en.ts`

- [ ] **Step 1: 添加中文翻译**

在 `locales/zh.ts` 的 `config` 对象中添加以下翻译：

```typescript
config: {
  // ... 现有翻译
  bannerTitle: '配置较多，建议清理',
  bannerDescription: '您已有 {count} 个配置，建议清理不常用的配置。',
  bannerStats: '当前显示 {total} 个配置，其中 {active} 个处于活跃状态。',
}
```

- [ ] **Step 2: 添加英文翻译**

在 `locales/en.ts` 的 `config` 对象中添加以下翻译：

```typescript
config: {
  // ... 现有翻译
  bannerTitle: 'Many configurations, consider cleanup',
  bannerDescription: 'You have {count} configurations. Consider cleaning up unused ones.',
  bannerStats: 'Currently showing {total} configurations, {active} active.',
}
```

- [ ] **Step 3: Commit**

```bash
git add locales/zh.ts locales/en.ts
git commit -m "feat: 添加配置数量 Banner 国际化翻译"
```

---

### Task 2: 在 ConfigManager 中添加 Banner 逻辑

**Files:**
- Modify: `components/dialogs/ConfigManager.tsx:27-38` (添加状态)
- Modify: `components/dialogs/ConfigManager.tsx:39-49` (添加 useEffect)

- [ ] **Step 1: 添加 Banner 状态**

在 `ConfigManager` 组件的 state 声明部分（第 27-38 行）添加：

```typescript
const [showBanner, setShowBanner] = useState(false);
```

- [ ] **Step 2: 添加 Banner 状态管理逻辑**

在 `useEffect` 之后添加：

```typescript
useEffect(() => {
  if (configs.length >= 15) {
    const dismissed = sessionStorage.getItem('config-banner-dismissed');
    if (!dismissed) {
      setShowBanner(true);
    }
  } else {
    setShowBanner(false);
  }
}, [configs.length]);

const handleDismissBanner = () => {
  setShowBanner(false);
  sessionStorage.setItem('config-banner-dismissed', 'true');
};
```

- [ ] **Step 3: Commit**

```bash
git add components/dialogs/ConfigManager.tsx
git commit -m "feat: 添加配置数量 Banner 状态管理逻辑"
```

---

### Task 3: 在 ConfigManager 中添加 Banner UI

**Files:**
- Modify: `components/dialogs/ConfigManager.tsx:186-188` (在列表顶部添加 Banner)

- [ ] **Step 1: 添加 Banner 渲染**

在 `ScrollToTop` 组件内部，`filteredConfigs.map()` 之前添加：

```tsx
{showBanner && (
  <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
        <AlertTriangle size={16} className="text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--fg)]">{t('config.bannerTitle')}</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          {t('config.bannerDescription').replace('{count}', String(configs.length))}
        </p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          {t('config.bannerStats')
            .replace('{total}', String(filteredConfigs.length))
            .replace('{active}', String(configs.filter(c => c.id === activeConfigId).length))}
        </p>
      </div>
      <button
        onClick={handleDismissBanner}
        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200 flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 2: 验证导入**

确保 `AlertTriangle` 已从 lucide-react 导入（第 8 行已有）。

- [ ] **Step 3: Commit**

```bash
git add components/dialogs/ConfigManager.tsx
git commit -m "feat: 添加配置数量 Banner UI 渲染"
```

---

### Task 4: 测试功能

**Files:**
- None (手动测试)

- [ ] **Step 1: 测试 Banner 不显示**

1. 打开配置管理器
2. 确保配置数量 < 15
3. 验证不显示 Banner

- [ ] **Step 2: 测试 Banner 显示**

1. 添加配置直到数量 ≥ 15
2. 验证 Banner 显示在列表顶部
3. 验证显示正确的统计信息

- [ ] **Step 3: 测试 Banner 关闭**

1. 点击 [×] 关闭 Banner
2. 验证 Banner 消失
3. 刷新页面，验证 Banner 不再显示（同一会话内）

- [ ] **Step 4: 测试会话重置**

1. 关闭浏览器标签页
2. 重新打开应用
3. 验证 Banner 再次显示（如果配置仍 ≥ 15）

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: 完成配置数量软提示功能"
```

---

## 自审清单

- [x] **规格覆盖**: 所有设计文档中的需求都有对应的实现步骤
- [x] **Placeholder 扫描**: 没有 TBD、TODO 或模糊描述
- [x] **类型一致性**: 状态变量名、函数名、翻译键名保持一致
- [x] **边界情况**: 覆盖了配置数量增减的边界情况
- [x] **国际化**: 中英文翻译都已添加
