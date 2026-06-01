# LLM 配置数量软提示设计文档

## 背景

用户可以无限制地添加 LLM 配置，当配置数量较多时，列表会变得冗长，影响管理效率。需要添加一个软提示功能，当配置数量达到一定阈值时提醒用户清理不常用的配置。

## 目标

1. 当配置数量 ≥ 15 时，在配置列表顶部显示一个可关闭的提示横幅
2. 提示显示配置统计信息（总数、活跃数）
3. 用户可关闭提示，关闭后本次会话不再显示
4. 提示样式与应用的毛玻璃设计风格一致

## 功能需求

### 触发条件
- 配置数量 ≥ 15 时显示
- 配置数量 < 15 时不显示

### 显示内容
- 警告图标（⚠️）
- 提示文本："您已有 X 个配置，建议清理不常用的配置。"
- 统计信息："当前显示 X 个配置，其中 Y 个处于活跃状态。"
- 关闭按钮（×）

### 交互行为
- 点击 [×] 关闭提示
- 关闭后使用 `sessionStorage` 存储状态
- 本次会话内不再显示
- 下次打开配置管理器时，如果仍 ≥ 15 个，会再次显示

### 位置
- 在配置列表内部顶部（Scrollable List 内）
- 随列表滚动

## 技术方案

### 组件结构
在 `ConfigManager.tsx` 中直接实现，不创建新组件（因为是特定场景的提示）。

### 状态管理
```typescript
const [showBanner, setShowBanner] = useState(false);

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

### 样式
使用现有的毛玻璃风格：
- 背景：`bg-[var(--surface-warm-hover)]`
- 边框：`border-[var(--border)]`
- 圆角：`rounded-2xl`
- 图标：使用 lucide-react 的 `AlertTriangle`
- 文本：`text-[var(--muted)]`

### 位置
在 `ScrollToTop` 组件内部，配置列表的顶部：
```tsx
<ScrollToTop className="px-7 pb-6 scrollbar-thin">
  <div className="space-y-2">
    {/* Banner 放在这里 */}
    {showBanner && (
      <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
        {/* Banner 内容 */}
      </div>
    )}
    {/* 配置列表 */}
    {filteredConfigs.map(...)}
  </div>
</ScrollToTop>
```

## 实现细节

### 文件修改
- `components/dialogs/ConfigManager.tsx` - 添加 Banner 逻辑和 UI

### 依赖
- 无新增依赖
- 使用现有的 lucide-react 图标
- 使用现有的 sessionStorage API

### 国际化
需要添加以下翻译键：
- `config.banner.title` - "配置较多，建议清理"
- `config.banner.description` - "您已有 {count} 个配置，建议清理不常用的配置。"
- `config.banner.stats` - "当前显示 {total} 个配置，其中 {active} 个处于活跃状态。"

## 测试计划

### 功能测试
1. 配置数量 < 15 时，不显示 Banner
2. 配置数量 ≥ 15 时，显示 Banner
3. 点击 [×] 关闭 Banner
4. 关闭后本次会话不再显示
5. 下次打开时，如果仍 ≥ 15 个，再次显示

### 样式测试
1. Banner 样式与应用风格一致
2. 在不同屏幕尺寸下显示正常
3. 毛玻璃效果正常

### 边界情况
1. 配置数量正好 15 时显示
2. 配置数量从 14 增加到 15 时显示
3. 配置数量从 15 减少到 14 时隐藏
4. 删除配置后数量 < 15 时隐藏

## 设计决策

### 为什么使用 sessionStorage？
- 提示只在当前会话内关闭
- 刷新页面或重新打开应用时，如果配置仍多，会再次提示
- 避免永久关闭提示

### 为什么在列表内部？
- 不改变现有布局
- 用户滚动时自然消失
- 符合"软提示"的定位

### 为什么使用内联实现？
- 特定场景的提示，不需要通用组件
- 减少组件数量
- 实现简单
