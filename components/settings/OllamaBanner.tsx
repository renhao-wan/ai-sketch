'use client';

import { Plus, Loader2 } from 'lucide-react';
import { useLocale } from '@/lib/locales';

interface OllamaBannerProps {
  /** 检测到的 Ollama 模型列表 */
  models: { id: string; name: string }[];
  /** 是否正在创建配置 */
  creating: boolean;
  /** 点击添加按钮的回调 */
  onAdd: () => void;
}

/**
 * Ollama 检测提示 Banner
 * 当检测到本地 Ollama 服务且存在未配置的模型时显示
 */
export default function OllamaBanner({ models, creating, onAdd }: OllamaBannerProps) {
  const { t } = useLocale();

  return (
    <div className="px-4 py-3 bg-[var(--accent-indigo)]/10 rounded-xl flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--accent-indigo)]">{t('config.ollamaDetected')}</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          {t('config.ollamaDetectedDesc', { count: models.length })}
        </p>
      </div>
      <button
        onClick={onAdd}
        disabled={creating}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] transition-all duration-200 font-medium disabled:opacity-50"
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        <span>{creating ? t('common.loading') : t('config.addOllamaConfig')}</span>
      </button>
    </div>
  );
}
