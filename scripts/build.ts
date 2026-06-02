/**
 * Electron 打包脚本
 *
 * 一键打包功能，自动完成以下步骤：
 * 1. 检测当前操作系统和 CPU 架构
 * 2. 清理旧的构建产物（.next、dist、out 目录）
 * 3. 构建 Next.js 应用（pnpm build）
 * 4. 使用 electron-builder 打包 Electron 应用
 *
 * 使用方式：
 *   npx ts-node --transpile-only scripts/build.ts
 *   或通过 pnpm electron:build 命令调用
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * 检测当前操作系统平台
 *
 * 将 Node.js 的 process.platform 映射为 electron-builder 识别的平台标识：
 * - win32  -> 'win'
 * - darwin -> 'mac'
 * - linux  -> 'linux'
 *
 * @returns electron-builder 平台标识
 * @throws 不支持的操作系统时抛出错误
 */
function detectPlatform(): string {
  switch (process.platform) {
    case 'win32':
      return 'win';
    case 'darwin':
      return 'mac';
    case 'linux':
      return 'linux';
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

/**
 * 检测当前 CPU 架构
 *
 * 将 Node.js 的 process.arch 映射为 electron-builder 识别的架构标识：
 * - arm64 -> 'arm64'（Apple Silicon、ARM Windows 等）
 * - 其他  -> 'x64'（Intel/AMD 64位）
 *
 * @returns electron-builder 架构标识
 */
function detectArch(): string {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

/**
 * 清理历史构建产物目录
 *
 * 删除以下目录（如存在）：
 * - .next  — Next.js 构建缓存
 * - dist   — electron-builder 输出目录
 * - out    — 备用输出目录
 *
 * 使用 force: true 确保在目录不存在时不抛出异常
 */
function cleanBuild(): void {
  const dirs = ['.next', 'dist', 'out'];
  dirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  Cleaned: ${dir}/`);
    }
  });
}

/**
 * 构建 Next.js 应用
 *
 * 执行 pnpm build 命令，即 next build --webpack。
 * 构建产物输出到 .next 目录。
 *
 * @throws 构建失败时 execSync 会抛出异常
 */
function buildNext(): void {
  console.log('Building Next.js...');
  execSync('pnpm build', { stdio: 'inherit' });
}

/**
 * 使用 electron-builder 打包 Electron 应用
 *
 * 根据平台和架构选择对应的打包命令：
 * - Windows: npx electron-builder --win --{arch}
 * - macOS:   npx electron-builder --mac --{arch}
 * - Linux:   npx electron-builder --linux --{arch}
 *
 * 打包配置由项目根目录的 electron-builder.yml 控制。
 * 输出目录为 dist/（由 electron-builder.yml 的 directories.output 指定）。
 *
 * @param platform - 操作系统平台标识（win | mac | linux）
 * @param arch     - CPU 架构标识（x64 | arm64）
 * @throws 打包失败时 execSync 会抛出异常
 */
function buildElectron(platform: string, arch: string): void {
  console.log(`Packaging for ${platform}-${arch}...`);

  const commands: Record<string, string> = {
    win: `npx electron-builder --win --${arch}`,
    mac: `npx electron-builder --mac --${arch}`,
    linux: `npx electron-builder --linux --${arch}`,
  };

  const command = commands[platform];
  if (!command) {
    throw new Error(`No build command defined for platform: ${platform}`);
  }

  execSync(command, { stdio: 'inherit' });
}

/**
 * 主函数 — 执行完整的打包流程
 *
 * 流程：
 * 1. 检测平台和架构
 * 2. 清理旧构建产物
 * 3. 构建 Next.js
 * 4. 打包 Electron
 * 5. 输出完成信息和产物目录路径
 */
async function main(): Promise<void> {
  const platform = detectPlatform();
  const arch = detectArch();

  console.log(`Detected platform: ${platform}, architecture: ${arch}`);
  console.log('');

  // Step 1: 清理
  console.log('[1/3] Cleaning build directories...');
  cleanBuild();

  // Step 2: 构建 Next.js
  console.log('[2/3] Building Next.js application...');
  buildNext();

  // Step 3: 打包 Electron
  console.log('[3/3] Packaging Electron application...');
  buildElectron(platform, arch);

  console.log('');
  console.log('Build complete!');
  console.log(`Output directory: ${path.resolve('dist')}`);
}

main().catch((error: Error) => {
  console.error('Build failed:', error.message);
  process.exit(1);
});
