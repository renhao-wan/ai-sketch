'use client';

import { CHART_TYPES } from '@/lib/constants';
import Dropdown from './ui/Dropdown';

interface ChartTypeSelectProps {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

const CHART_TYPE_OPTIONS = Object.entries(CHART_TYPES).map(([value, label]) => ({ value, label }));

export default function ChartTypeSelect({ value, onChange, disabled, id }: ChartTypeSelectProps) {
  return (
    <Dropdown
      options={CHART_TYPE_OPTIONS}
      value={value}
      onChange={(v) => onChange?.(v)}
      disabled={disabled}
      placeholder="选择图表类型"
      className="px-3 py-2 text-xs"
    />
  );
}
