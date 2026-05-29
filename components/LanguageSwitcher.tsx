'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Globe } from 'lucide-react';
import { useLocale, type Locale } from '@/locales';

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePanelPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 99999,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePanelPosition();
      window.addEventListener('resize', updatePanelPosition);
      return () => window.removeEventListener('resize', updatePanelPosition);
    }
  }, [isOpen, updatePanelPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        const panel = document.getElementById('lang-panel');
        if (!panel || !panel.contains(target)) setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
        title={t('lang.label')}
      >
        <Globe size={15} />
      </button>
      {isOpen && createPortal(
        <div
          id="lang-panel"
          style={panelStyle}
          className="bg-[var(--surface-warm)] backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-[0_4px_16px_rgba(28,25,23,0.06)] overflow-hidden animate-fade-in"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => { setLocale(lang.value); setIsOpen(false); }}
              className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors duration-150 ${
                lang.value === locale
                  ? 'bg-[var(--accent-indigo)]/8 text-[var(--accent-indigo)]'
                  : 'text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
