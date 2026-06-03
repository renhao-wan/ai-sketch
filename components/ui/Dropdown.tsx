'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useLocale } from '@/lib/locales';

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
}: DropdownProps) {
  const { t } = useLocale();
  const resolvedPlaceholder = placeholder ?? t('dropdown.placeholder');
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const updatePanelPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const panelMaxH = 180;

    if (spaceBelow < panelMaxH && spaceAbove > spaceBelow) {
      setPanelStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + gap,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
        maxHeight: Math.min(panelMaxH, spaceAbove),
      });
    } else {
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
        maxHeight: Math.min(panelMaxH, spaceBelow),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePanelPosition();
      window.addEventListener('scroll', updatePanelPosition, true);
      window.addEventListener('resize', updatePanelPosition);
      return () => {
        window.removeEventListener('scroll', updatePanelPosition, true);
        window.removeEventListener('resize', updatePanelPosition);
      };
    }
  }, [isOpen, updatePanelPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        const panel = document.getElementById('dropdown-panel');
        if (!panel || !panel.contains(target)) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const triggerClass = [
    'w-full px-4 py-2.5 text-sm rounded-xl text-left',
    'bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)]',
    'text-[var(--fg)] cursor-pointer',
    'hover:bg-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30',
    'transition-all duration-200 flex items-center justify-between',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    className ?? '',
  ].join(' ');

  const panel = isOpen ? createPortal(
    <div
      id="dropdown-panel"
      style={panelStyle}
      className="bg-[var(--surface-warm)] backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-[0_4px_16px_rgba(28,25,23,0.06)] overflow-hidden animate-fade-in"
    >
      <div className="overflow-y-auto scrollbar-thin py-1" style={{ maxHeight: panelStyle.maxHeight }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={`w-full px-3.5 py-2 text-left text-[13px] transition-colors duration-150 flex items-center justify-between ${
              option.value === value
                ? 'bg-[var(--accent-indigo)]/8 text-[var(--accent-indigo)]'
                : 'text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
            }`}
          >
            <div className="min-w-0">
              <div className="truncate">{option.label}</div>
              {option.description && (
                <div className="text-[11px] text-[var(--muted)] truncate mt-0.5">{option.description}</div>
              )}
            </div>
            {option.value === value && (
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-indigo)] flex-shrink-0 ml-2" />
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={triggerClass}
      >
        <span className={`truncate ${selected ? '' : 'text-[var(--muted)]/50'}`}>
          {selected?.label ?? resolvedPlaceholder}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 ml-2 text-[var(--muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {panel}
    </div>
  );
}
