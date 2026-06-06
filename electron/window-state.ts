/**
 * 窗口状态持久化
 * 保存和恢复窗口的位置、大小、最大化状态
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const DEFAULT_STATE: WindowState = { width: 1200, height: 800, isMaximized: false };

/** 加载上次保存的窗口状态，失败时返回默认值 */
export function loadWindowState(): WindowState {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return { ...DEFAULT_STATE, ...parsed };
    }
    return DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

/** 保存窗口状态到文件 */
export function saveWindowState(state: WindowState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) {
    console.error('[Window] 保存窗口状态失败:', e);
  }
}
