/**
 * Cross-page initial data transport (homepage → editor).
 * Uses sessionStorage — data lives for the tab session, auto-clears on tab close.
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';

const KEY = 'ai-sketch-init-data';

export interface InitData {
  type: 'text' | 'file' | 'image';
  data: unknown;
  format: DiagramFormat;
}

/** Store init data before navigating to editor */
export function setInitData(data: InitData): void {
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

/** Read and consume init data (one-shot — removes after reading) */
export function consumeInitData(): InitData | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as InitData;
  } catch {
    return null;
  }
}
