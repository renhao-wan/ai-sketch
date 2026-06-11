import type { DiagramFormat } from '@/lib/types/diagram-strategy';

/**
 * 从代码内容推断图表格式
 * - 以 `<` 开头 → Draw.io XML
 * - 以 `[` 开头 → Excalidraw JSON
 * - 包含 `"elements"` 的 JSON → Excalidraw
 * - 其他 → Mermaid
 */
export function detectCodeFormat(code: string): DiagramFormat {
  const trimmed = code.trim();
  if (trimmed.startsWith('<')) return 'drawio';
  if (trimmed.startsWith('[')) return 'excalidraw';
  if (trimmed.startsWith('{') && trimmed.includes('"elements"')) return 'excalidraw';
  return 'mermaid';
}
