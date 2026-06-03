# 部署指南

本文档介绍如何部署 AI Sketch 应用，包括 Web 端和 Electron 桌面端。

## Web 端部署

### 环境要求

- Node.js 18+
- pnpm 10+

### 构建

```bash
# 安装依赖
pnpm install

# 构建生产版本
pnpm build
```

构建产物位于 `.next` 目录。

### 启动生产服务器

```bash
pnpm start
```

默认监听 http://localhost:3000。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_SKETCH_DB_PATH` | SQLite 数据库路径 | `./data/ai-sketch.db` |
| `HTTP_PROXY` | HTTP 代理 | - |
| `HTTPS_PROXY` | HTTPS 代理 | - |

### 部署到 Vercel

1. Fork 本仓库到你的 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量（如果需要）
4. 点击部署

**注意**：Vercel 是 Serverless 环境，SQLite 文件存储不持久化。建议使用外部数据库或 Vercel Postgres。

### 部署到 Docker

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine AS base

# 安装 pnpm
RUN npm install -g pnpm

# 依赖安装
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 构建
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# 生产
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

创建 `docker-compose.yml`：

```yaml
version: '3'

services:
  ai-sketch:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
```

运行：

```bash
docker-compose up -d
```

### 部署到自有服务器

#### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 构建
pnpm build

# 启动
pm2 start pnpm --name "ai-sketch" -- start

# 设置开机自启
pm2 startup
pm2 save
```

#### 使用 systemd

创建 `/etc/systemd/system/ai-sketch.service`：

```ini
[Unit]
Description=AI Sketch
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/ai-sketch
ExecStart=/usr/bin/pnpm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl enable ai-sketch
sudo systemctl start ai-sketch
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

### HTTPS 配置

使用 Let's Encrypt：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## Electron 桌面端打包

### 环境要求

- Node.js 18+
- pnpm 10+
- 对应平台的构建工具（见下方）

#### Windows

- Visual Studio Build Tools（C++ 桌面开发工作负载）
- 或 Windows SDK

#### macOS

- Xcode Command Line Tools

```bash
xcode-select --install
```

#### Linux

```bash
sudo apt install build-essential libarchive-tools rpm
```

### 打包命令

```bash
# 安装依赖
pnpm install

# 一键打包（自动检测平台）
pnpm electron:build

# 或手动指定平台
npx electron-builder --win --x64    # Windows
npx electron-builder --mac --x64    # macOS Intel
npx electron-builder --mac --arm64  # macOS Apple Silicon
npx electron-builder --linux --x64  # Linux
```

### 打包产物

打包产物位于 `dist/` 目录：

| 平台 | 文件 | 说明 |
|------|------|------|
| Windows | `AI Sketch Setup x.x.x.exe` | NSIS 安装包 |
| Windows | `win-unpacked/` | 解压目录 |
| macOS | `AI Sketch-x.x.x.dmg` | DMG 镜像 |
| Linux | `AI Sketch-x.x.x.AppImage` | AppImage |

### 打包配置

打包配置位于 `electron-builder.yml`：

```yaml
appId: com.ai-sketch.app
productName: AI Sketch

directories:
  output: dist
  buildResources: electron/resources

files:
  - "**/*"
  - "!**/*.ts"
  - "!**/*.tsx"
  - "!.next/cache/**"
  - "dist-electron/**"
  - "app/**"
  - "lib/**"

extraResources:
  - from: "data"
    to: "data"

win:
  target:
    - target: nsis
      arch: [x64]
  icon: electron/resources/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  include: electron/resources/uninstaller.nsh

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  icon: electron/resources/icon.icns

linux:
  target:
    - target: AppImage
      arch: [x64]
  icon: electron/resources/icon.png
```

### 数据存储位置

Electron 应用数据存储在系统标准位置：

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%/ai-sketch/` |
| macOS | `~/Library/Application Support/ai-sketch/` |
| Linux | `~/.config/ai-sketch/` |

### 卸载行为

Windows 卸载时会弹出对话框询问是否删除应用数据：

- **删除数据**：删除 `%APPDATA%/ai-sketch/` 和 `%LOCALAPPDATA%/ai-sketch/`
- **保留数据**：仅删除应用，保留数据

### 代码签名

#### Windows

在 `electron-builder.yml` 中配置：

```yaml
win:
  sign: true
  certificateFile: path/to/certificate.pfx
  certificatePassword: ${CERTIFICATE_PASSWORD}
```

或使用环境变量：

```bash
export CSC_LINK=path/to/certificate.pfx
export CSC_KEY_PASSWORD=your-password
pnpm electron:build
```

#### macOS

需要 Apple Developer 证书：

```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAM_ID)"
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: electron/resources/entitlements.mac.plist
```

### 自动更新

项目未实现自动更新功能。如需添加，可使用 `electron-updater`：

```bash
pnpm add electron-updater
```

在 `electron/main.ts` 中添加：

```typescript
import { autoUpdater } from 'electron-updater';

app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();
});
```

---

## 开发模式

### Web 开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000。

### Electron 开发模式

```bash
pnpm electron:dev
```

这会同时启动 Next.js 开发服务器和 Electron 应用。

### 开发模式端口

- Web 开发服务器：http://localhost:3000
- Electron 开发模式会自动连接到上述端口

---

## 故障排除

### Web 端

#### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或使用其他端口
PORT=3001 pnpm start
```

#### SQLite 错误

```bash
# 删除数据库文件重新开始
rm data/ai-sketch.db
```

#### 内存不足

```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

### Electron 端

#### 打包失败

```bash
# 清理缓存
rm -rf node_modules/.cache
rm -rf dist
rm -rf .next

# 重新安装依赖
pnpm install

# 重新打包
pnpm electron:build
```

#### Windows 权限问题

```bash
# 清理 .next 目录
rm -rf .next

# 重新构建
pnpm build
```

#### Electron 下载失败

在 `.npmrc` 中配置镜像源：

```ini
electron_mirror=https://npmmirror.com/mirrors/electron/
```

---

## 监控与日志

### Web 端日志

Next.js 日志输出到控制台。生产环境建议使用 PM2 日志：

```bash
pm2 logs ai-sketch
```

### Electron 日志

Electron 主进程日志输出到控制台。生产环境可使用 `electron-log`：

```bash
pnpm add electron-log
```

在 `electron/main.ts` 中：

```typescript
import log from 'electron-log';

log.info('应用启动');
log.error('发生错误:', error);
```

日志文件位置：
- Windows: `%APPDATA%/ai-sketch/logs/`
- macOS: `~/Library/Logs/ai-sketch/`
- Linux: `~/.config/ai-sketch/logs/`

---

## 性能优化

### Web 端

1. **启用 Gzip 压缩**：在 Nginx 中配置
2. **使用 CDN**：静态资源使用 CDN 加速
3. **缓存策略**：配置适当的缓存头

### Electron 端

1. **减小包体积**：排除不必要的文件
2. **延迟加载**：使用动态导入
3. **优化启动**：使用 `show: false` + `ready-to-show`

---

## 相关文档

- [架构概览](../architecture/overview.md) — 整体架构设计
- [API 接口文档](../api/endpoints.md) — 后端 API 接口说明
- [开发扩展指南](./extend-diagram.md) — 如何添加新功能
- [Electron 开发指南](../electron/electron.md) — 桌面应用开发
