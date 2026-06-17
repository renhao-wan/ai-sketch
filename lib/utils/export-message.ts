import { detectCodeFormat } from './detect-code-format';

/** 导出消息内容为文件 */
export function exportMessage(content: string) {
  const format = detectCodeFormat(content);
  const ext = format === 'excalidraw' ? 'json' : format === 'mermaid' ? 'mmd' : 'drawio';
  const mime = format === 'excalidraw' ? 'application/json' : format === 'mermaid' ? 'text/plain' : 'application/xml';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diagram.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
