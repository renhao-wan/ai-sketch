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

/** 延迟初始化状态文件路径，避免在 app.whenReady() 前调用 app.getPath() */
let _stateFile: string | null = null;
function getStateFile(): string {
  if (!_stateFile) {
    _stateFile = path.join(app.getPath('userData'), 'window-state.json');
  }
  return _stateFile;
}

const DEFAULT_STATE: WindowState = { width: 1200, height: 800, isMaximized: false };

/** 数值范围限制 */
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/** 加载上次保存的窗口状态，失败时返回默认值 */
export function loadWindowState(): WindowState {
  try {
    const data = fs.readFileSync(getStateFile(), 'utf-8');
    const parsed = JSON.parse(data);
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return {
        ...DEFAULT_STATE,
        ...parsed,
        // 限制窗口尺寸范围，防止恶意修改或异常值
        width: clamp(parsed.width, 400, 7680),
        height: clamp(parsed.height, 300, 4320),
        // 限制坐标范围，防止窗口移出屏幕
        x: typeof parsed.x === 'number' ? clamp(parsed.x, -500, 7680) : undefined,
        y: typeof parsed.y === 'number' ? clamp(parsed.y, -500, 4320) : undefined,
      };
    }
    return DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

/** 保存窗口状态到文件 */
export function saveWindowState(state: WindowState): void {
  try {
    fs.writeFileSync(getStateFile(), JSON.stringify(state));
  } catch (e) {
    console.error('[Window] 保存窗口状态失败:', e);
  }
}
