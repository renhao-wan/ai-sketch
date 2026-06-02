'use client';

import { getChartTypeLabel } from '@/lib/diagram/constants';
import { useLocale } from '@/lib/locales';
import Dropdown from '@/components/ui/Dropdown';

interface ChartTypeSelectProps {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export default function ChartTypeSelect({ value, onChange, disabled, id }: ChartTypeSelectProps) {
  const { t } = useLocale();

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

  return (
    <Dropdown
      options={options}
      value={value}
      onChange={(v) => onChange?.(v)}
      disabled={disabled}
      placeholder={t('dropdown.selectChartType')}
      className="px-3 py-2 text-xs"
    />
  );
}
