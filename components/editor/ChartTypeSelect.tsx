'use client';

import { useCallback } from 'react';
import { getChartTypeLabel } from '@/lib/diagram/constants';
import { isMermaidTypeSupported } from '@/lib/prompts/mermaid';
import { useLocale } from '@/lib/locales';
import { useNotification } from '@/lib/contexts/NotificationContext';
import Dropdown from '@/components/ui/Dropdown';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

interface ChartTypeSelectProps {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
  /** 当前图表格式，用于检查 Mermaid 类型支持 */
  format?: DiagramFormat;
}

export default function ChartTypeSelect({ value, onChange, disabled, id, format }: ChartTypeSelectProps) {
  const { t } = useLocale();
  const { showNotification } = useNotification();

  const chartTypeKeys = [
    'auto', 'flowchart', 'mindmap', 'orgchart', 'sequence', 'class', 'er',
    'gantt', 'timeline', 'tree', 'network', 'architecture', 'dataflow',
    'state', 'swimlane', 'concept', 'fishbone', 'swot', 'pyramid',
    'funnel', 'venn', 'matrix', 'infographic',
  ];

  const options = chartTypeKeys.map((key) => ({
    value: key,
    label: getChartTypeLabel(key, t),
  }));

  const handleChange = useCallback((v: string) => {
    // 检查 Mermaid 不支持的类型
    if (format === 'mermaid' && v !== 'auto' && !isMermaidTypeSupported(v)) {
      const chartName = getChartTypeLabel(v, t);
      showNotification(
        t('notification.unsupportedType'),
        t('notification.mermaidUnsupported', { type: chartName }),
        'warning',
      );
    }
    onChange?.(v);
  }, [format, onChange, showNotification, t]);

  return (
    <Dropdown
      options={options}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={t('dropdown.selectChartType')}
      className="px-3 py-2 text-xs"
    />
  );
}
