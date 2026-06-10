'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '@/lib/locales';
import { Eye, Save, Trash2, TestTube2, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface VisionConfigState {
  apiType: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface VisionSettingsProps {
  isVisible?: boolean;
}

export default function VisionSettings({ isVisible }: VisionSettingsProps) {
  const { t } = useLocale();
  const [config, setConfig] = useState<VisionConfigState>({
    apiType: 'openai',
    baseUrl: '',
    apiKey: '',
    model: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentModel, setCurrentModel] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/vision/config');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({
            apiType: data.config.apiType,
            baseUrl: data.config.baseUrl,
            apiKey: data.config.apiKey,
            model: data.config.model,
          });
          setIsConfigured(true);
          setCurrentModel(data.config.model);
        } else {
          setIsConfigured(false);
          setCurrentModel('');
        }
      }
    } catch (error) {
      console.error('Failed to load vision config:', error);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadConfig();
      setTestResult(null);
    }
  }, [isVisible, loadConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/vision/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setIsConfigured(true);
        setCurrentModel(config.model);
        setTestResult(null);
      }
    } catch (error) {
      console.error('Failed to save vision config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch('/api/vision/config', { method: 'DELETE' });
      setConfig({ apiType: 'openai', baseUrl: '', apiKey: '', model: '' });
      setIsConfigured(false);
      setCurrentModel('');
      setTestResult(null);
    } catch (error) {
      console.error('Failed to delete vision config:', error);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/vision/test', { method: 'POST' });
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ success: false, message: (error as Error).message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 状态卡片 */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-indigo)]/10 flex items-center justify-center">
            <Eye size={20} className="text-[var(--accent-indigo)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">
              {t('vision.status')}: {isConfigured ? t('vision.statusConfigured') : t('vision.statusNotConfigured')}
            </p>
            {currentModel && (
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {t('vision.currentModel')}: {currentModel}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 配置表单 */}
      <div className="space-y-4">
        {/* API 类型 */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('vision.apiType')}
          </label>
          <select
            value={config.apiType}
            onChange={(e) => setConfig(prev => ({ ...prev, apiType: e.target.value as 'openai' | 'anthropic' }))}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          >
            <option value="openai">{t('vision.apiTypeOpenai')}</option>
            <option value="anthropic">{t('vision.apiTypeAnthropic')}</option>
          </select>
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('vision.baseUrl')}
          </label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
            placeholder={t('vision.baseUrlPlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('vision.apiKey')}
          </label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder={t('vision.apiKeyPlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          />
        </div>

        {/* 模型名 */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('vision.model')}
          </label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
            placeholder={t('vision.modelPlaceholder')}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !config.baseUrl || !config.apiKey || !config.model}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-indigo)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t('vision.save')}
        </button>

        <button
          onClick={handleTest}
          disabled={isTesting || !isConfigured}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--fg)] text-sm font-medium hover:bg-[var(--surface-warm-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isTesting ? <Loader2 size={16} className="animate-spin" /> : <TestTube2 size={16} />}
          {t('vision.test')}
        </button>

        {isConfigured && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
          >
            <Trash2 size={16} />
            {t('common.delete')}
          </button>
        )}
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          testResult.success
            ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
            : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
        }`}>
          {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {testResult.message}
        </div>
      )}

      {/* 提示信息 */}
      <p className="text-xs text-[var(--muted)]">
        {t('vision.noConfig')}
      </p>
    </div>
  );
}
