'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Loader2, Save, TestTube2, Trash2, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import { useNotification } from '@/lib/contexts/NotificationContext';
import Dropdown from '@/components/ui/Dropdown';

interface VisionFormData {
  apiType: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface VisionConfigPanelProps {
  /** 点击返回按钮的回调 */
  onBack: () => void;
}

/**
 * Vision API 配置页面
 * 独立管理 Vision 配置的加载、保存、测试、删除
 */
export default function VisionConfigPanel({ onBack }: VisionConfigPanelProps) {
  const { t } = useLocale();
  const { showNotification } = useNotification();

  const [visionConfig, setVisionConfig] = useState<VisionFormData>({
    apiType: 'openai', baseUrl: '', apiKey: '', model: '',
  });
  const [visionSaving, setVisionSaving] = useState(false);
  const [visionTesting, setVisionTesting] = useState(false);
  const [visionTestResult, setVisionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [visionIsConfigured, setVisionIsConfigured] = useState(false);
  const [visionCurrentModel, setVisionCurrentModel] = useState('');

  const loadVisionConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/vision/config');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setVisionConfig({
            apiType: data.config.apiType,
            baseUrl: data.config.baseUrl,
            apiKey: data.config.apiKey,
            model: data.config.model,
          });
          setVisionIsConfigured(true);
          setVisionCurrentModel(data.config.model);
        } else {
          setVisionIsConfigured(false);
          setVisionCurrentModel('');
        }
      }
    } catch (error) {
      console.error('Failed to load vision config:', error);
    }
  }, []);

  useEffect(() => {
    loadVisionConfig();
    setVisionTestResult(null);
  }, [loadVisionConfig]);

  const handleVisionSave = async () => {
    setVisionSaving(true);
    try {
      const response = await fetch('/api/vision/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visionConfig),
      });

      if (response.ok) {
        setVisionIsConfigured(true);
        setVisionCurrentModel(visionConfig.model);
        setVisionTestResult(null);
        showNotification(t('vision.saved'), '', 'success');
      } else {
        const data = await response.json().catch(() => ({}));
        showNotification(t('config.saveFailed'), data.error || '', 'error');
      }
    } catch (error) {
      showNotification(t('config.saveFailed'), (error as Error).message, 'error');
    } finally {
      setVisionSaving(false);
    }
  };

  const handleVisionDelete = async () => {
    try {
      await fetch('/api/vision/config', { method: 'DELETE' });
      setVisionConfig({ apiType: 'openai', baseUrl: '', apiKey: '', model: '' });
      setVisionIsConfigured(false);
      setVisionCurrentModel('');
      setVisionTestResult(null);
    } catch (error) {
      console.error('Failed to delete vision config:', error);
    }
  };

  const handleVisionTest = async () => {
    setVisionTesting(true);
    setVisionTestResult(null);
    try {
      const response = await fetch('/api/vision/test', { method: 'POST' });
      const data = await response.json();
      setVisionTestResult(data);
    } catch (error) {
      setVisionTestResult({ success: false, message: (error as Error).message });
    } finally {
      setVisionTesting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin pt-2">
      <div className="mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          <ArrowLeft size={16} />
          {t('config.backToList')}
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-indigo)]/10 flex items-center justify-center">
            <Eye size={20} className="text-[var(--accent-indigo)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--fg)]">{t('settings.vision')}</h3>
            <p className="text-xs text-[var(--muted)]">{t('settings.visionDesc')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('vision.apiType')}</label>
            <Dropdown
              options={[{ value: 'openai', label: t('vision.apiTypeOpenai') }, { value: 'anthropic', label: t('vision.apiTypeAnthropic') }]}
              value={visionConfig.apiType}
              onChange={(v) => setVisionConfig(prev => ({ ...prev, apiType: v as 'openai' | 'anthropic' }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('vision.model')}</label>
            <input
              type="text"
              value={visionConfig.model}
              onChange={(e) => setVisionConfig(prev => ({ ...prev, model: e.target.value }))}
              placeholder={t('vision.modelPlaceholder')}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('vision.baseUrl')}</label>
          <input
            type="text"
            value={visionConfig.baseUrl}
            onChange={(e) => setVisionConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
            placeholder={t('vision.baseUrlPlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('vision.apiKey')}</label>
          <input
            type="password"
            value={visionConfig.apiKey}
            onChange={(e) => setVisionConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder={t('vision.apiKeyPlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleVisionSave}
            disabled={visionSaving || !visionConfig.baseUrl || !visionConfig.apiKey || !visionConfig.model}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-indigo)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {visionSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('vision.save')}
          </button>
          <button
            onClick={handleVisionTest}
            disabled={visionTesting || !visionIsConfigured}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--fg)] text-sm font-medium hover:bg-[var(--surface-warm-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {visionTesting ? <Loader2 size={16} className="animate-spin" /> : <TestTube2 size={16} />}
            {t('vision.test')}
          </button>
          {visionIsConfigured && (
            <button
              onClick={handleVisionDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
            >
              <Trash2 size={16} />
              {t('common.delete')}
            </button>
          )}
        </div>

        {visionTestResult && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            visionTestResult.success
              ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
          }`}>
            {visionTestResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {visionTestResult.message}
          </div>
        )}

        {visionIsConfigured && (
          <div className="flex items-center gap-2 px-4 py-3 bg-[var(--accent-indigo)]/5 rounded-xl">
            <Eye size={16} className="text-[var(--accent-indigo)]" />
            <p className="text-sm text-[var(--fg)]">
              {t('vision.currentModel')}: <span className="font-medium">{visionCurrentModel}</span>
            </p>
          </div>
        )}

        <p className="text-xs text-[var(--muted)] pt-2">{t('vision.noConfig')}</p>
      </div>
    </div>
  );
}
