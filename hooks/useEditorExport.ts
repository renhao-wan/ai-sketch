'use client';

import { useCallback, type RefObject } from 'react';
import { downloadBlob, getFileExtension, getMimeType, type ExportFormat } from '@/lib/utils/export-diagram';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { useLocale } from '@/lib/locales';
import type { CanvasExportHandle } from '@/components/canvases/DiagramCanvas';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import { getStrategy } from '@/lib/strategies/registry';

interface UseEditorExportOptions {
  format: DiagramFormat;
  generatedCode: string;
  canvasExportRef: RefObject<CanvasExportHandle | null>;
}

export function useEditorExport({ format, generatedCode, canvasExportRef }: UseEditorExportOptions) {
  const { showNotification } = useNotification();
  const { t } = useLocale();

  const strategy = getStrategy(format);

  /** 导出为原始格式文件 */
  const handleExport = useCallback(() => {
    const blob = strategy.createExportBlob(generatedCode);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram.${strategy.fileExtension}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [strategy, generatedCode]);

  /** 导出为 PNG/SVG/代码文件 */
  const handleExportAs = useCallback(async (exportFormat: ExportFormat) => {
    if (exportFormat === 'code') {
      handleExport();
      return;
    }

    if (!canvasExportRef.current) {
      showNotification(t('notification.exportFailed'), t('notification.exportNotSupported'), 'error');
      return;
    }

    try {
      const blob = await canvasExportRef.current.exportAs(exportFormat);
      const ext = getFileExtension(exportFormat, format);
      const mime = getMimeType(exportFormat);
      const finalBlob = exportFormat === 'png' ? blob : new Blob([blob], { type: mime });
      downloadBlob(finalBlob, `diagram.${ext}`);
    } catch (e) {
      showNotification(t('notification.exportFailed'), (e as Error).message, 'error');
    }
  }, [format, handleExport, showNotification, t, canvasExportRef]);

  return {
    handleExport,
    handleExportAs,
  };
}
