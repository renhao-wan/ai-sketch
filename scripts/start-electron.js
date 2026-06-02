/**
 * Electron 启动脚本
 *
 * 解决 Windows 上 bash 命令兼容性问题。
 * 清除 ELECTRON_RUN_AS_NODE 环境变量，确保 Electron 以应用模式运行。
 */

const { spawn } = require('child_process');
const path = require('path');

// 清除 ELECTRON_RUN_AS_NODE 环境变量，并设置开发模式标志
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.ELECTRON_DEV = 'true';

// Electron 可执行文件路径
const electronPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');

// 项目根目录
const appPath = path.join(__dirname, '..');

// 启动 Electron
const child = spawn(electronPath, [appPath], {
  stdio: 'inherit',
  env,
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});
