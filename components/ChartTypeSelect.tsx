'use client';

import { CHART_TYPES } from '@/lib/constants';

interface ChartTypeSelectProps {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export default function ChartTypeSelect({ value, onChange, disabled, id }: ChartTypeSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="chart-type-select"
      disabled={disabled}
    >
      {Object.entries(CHART_TYPES).map(([key, label]) => (
        <option key={key} value={key}>{label}</option>
      ))}
    </select>
  );
}
