# Electron 桌面应用

## 开发

### 启动开发模式

```bash
pnpm electron:dev
```

这会同时启动 Next.js 开发服务器和 Electron 应用。

### 打包

```bash
pnpm electron:build
```

根据当前系统自动打包对应格式：
- Windows: NSIS 安装包
- macOS: DMG
- Linux: AppImage

### 手动打包

```bash
# Windows
npx electron-builder --win --x64

# macOS
npx electron-builder --mac --x64
npx electron-builder --mac --arm64

# Linux
npx electron-builder --linux --x64
```

## 数据存储

应用数据存储在系统标准位置：
- Windows: `%APPDATA%/ai-sketch/`
- macOS: `~/Library/Application Support/ai-sketch/`
- Linux: `~/.config/ai-sketch/`

## 卸载

卸载时会询问是否删除应用数据：
- 选择"删除数据"：删除所有配置和对话历史
- 选择"保留数据"：仅删除应用，保留数据

## 故障排除

### 应用无法启动

1. 检查端口 3000 是否被占用
2. 查看控制台错误日志
3. 尝试清理 `.next` 目录后重新构建

### 打包失败

1. 确保所有依赖已安装：`pnpm install`
2. 检查 Node.js 版本（需要 18+）
3. 查看详细错误信息
