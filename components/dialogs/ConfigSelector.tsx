'use client';

import { useState, useEffect } from 'react';
import * as api from '@/lib/api/client';
import ScrollToTop from '@/components/ui/ScrollToTop';
import { Search, Check, ExternalLink } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';
import type { LLMConfig } from '@/lib/types';

interface ConfigSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSelect: (config: LLMConfig) => void;
}

/** 简化的配置选择器 — 仅用于切换活跃配置，完整管理请去设置页 */
export default function ConfigSelector({ isOpen, onClose, onConfigSelect }: ConfigSelectorProps) {
  const { t } = useLocale();
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { if (isOpen) loadConfigs(); }, [isOpen]);

  const loadConfigs = async () => {
    try {
      setIsLoading(true);
      const data = await api.fetchConfigs();
      setConfigs(data.configs);
      setActiveConfigId(data.activeConfigId);
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetActive = async (config: LLMConfig) => {
    if (!config.id || config.id === activeConfigId) return;
    try {
      await api.setActiveConfig(config.id);
      setActiveConfigId(config.id);
      onConfigSelect(config);
    } catch (err) {
      console.error('Failed to set active config:', err);
    }
  };

  const filteredConfigs = configs.filter(config =>
    config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    config.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface-warm)] backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--fg)]">{t('config.title')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[var(--border)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('config.search')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-warm-hover)] border border-transparent rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30"
            />
          </div>
        </div>

        {/* Config List */}
        <ScrollToTop className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-3 space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-[var(--muted)]">
                {t('common.loading')}
              </div>
            ) : filteredConfigs.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--muted)]">
                {searchQuery ? t('config.noMatch') : t('config.noConfig')}
              </div>
            ) : (
              filteredConfigs.map((config) => (
                <button
                  key={config.id}
                  onClick={() => handleSetActive(config)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                    config.id === activeConfigId
                      ? 'border-[var(--accent-indigo)]/30 bg-[var(--accent-indigo)]/5'
                      : 'border-transparent bg-[var(--surface-warm-hover)] hover:bg-[var(--surface-warm-hover)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--fg)] truncate">{config.name}</span>
                        {config.id === activeConfigId && (
                          <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded-full">
                            {t('config.active')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                        {config.model}
                      </p>
                    </div>
                    {config.id === activeConfigId && (
                      <Check size={16} className="flex-shrink-0 text-[var(--accent-indigo)]" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollToTop>

        {/* Footer - Link to Settings */}
        <div className="p-3 border-t border-[var(--border)]">
          <a
            href="/settings?tab=llm"
            onClick={(e) => { e.preventDefault(); onClose(); window.location.href = '/settings?tab=llm'; }}
            className="flex items-center justify-center gap-2 w-full py-2 text-sm text-[var(--muted)] hover:text-[var(--accent-indigo)] transition-colors"
          >
            <ExternalLink size={14} />
            <span>{t('config.manageInSettings')}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
