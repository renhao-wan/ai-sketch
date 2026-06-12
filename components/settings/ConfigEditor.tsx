'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import { useLocale } from '@/lib/locales';
import type { LLMConfig, ModelInfo } from '@/lib/types';

interface ConfigEditorProps {
  config: Partial<LLMConfig>;
  isCreating: boolean;
  onSave: (config: Partial<LLMConfig>) => void;
  onCancel: () => void;
}

/**
 * 配置编辑器子组件（带 Modal 包装）
 * 用于新增/编辑配置的表单
 */
export default function ConfigEditor({ config, isCreating, onSave, onCancel }: ConfigEditorProps) {
  const { t } = useLocale();
  const [formData, setFormData] = useState<Partial<LLMConfig>>({ ...config });
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (formData.model) {
      if (models.length > 0) setUseCustomModel(!models.some(m => m.id === formData.model));
      else setUseCustomModel(true);
    }
  }, [models, formData.model]);

  /** 从 API 加载可用模型列表 */
  const handleLoadModels = async () => {
    if (!formData.type || !formData.baseUrl) {
      setError(t('config.fillRequired'));
      return;
    }
    // 非 Ollama 需要 API Key
    if (formData.type !== 'ollama' && !formData.apiKey) {
      setError(t('config.fillRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      let modelsData: ModelInfo[];
      if (formData.type === 'ollama') {
        // Ollama 使用专用检测端点
        const res = await fetch('/api/ollama/detect', { method: 'POST' });
        const data = await res.json();
        if (!data.detected) throw new Error(data.error || '未检测到 Ollama 服务');
        modelsData = data.models;
      } else {
        // 使用 POST 请求避免 API Key 出现在 URL 中
        const response = await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: formData.type, baseUrl: formData.baseUrl, apiKey: formData.apiKey }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('config.loadModelFailed'));
        modelsData = data.models;
      }
      setModels(modelsData);
    } catch (err) {
      setError((err as Error).message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  /** 保存配置（校验必填字段） */
  const handleSave = () => {
    if (!formData.name || !formData.type || !formData.baseUrl || !formData.model) {
      setError(t('config.fillAllRequired'));
      return;
    }
    // Ollama 不需要 API Key
    if (formData.type !== 'ollama' && !formData.apiKey) {
      setError(t('config.fillAllRequired'));
      return;
    }
    onSave(formData);
  };

  const inputClass = "w-full px-4 py-2.5 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 hover:border-[var(--accent-indigo)]/20 transition-all duration-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--surface-warm)] backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] w-full max-w-md max-h-[78vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">
            {isCreating ? t('config.new') : t('config.edit')}
          </h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-7 pb-6 space-y-4 overflow-y-auto scrollbar-hide flex-1 min-h-0">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.configName')} <span className="text-red-500">*</span></label>
            <input
              id="configName"
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('config.configNamePlaceholder')}
              className={inputClass}
            />
          </div>

        <div>
          <label htmlFor="configDescription" className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.description')}</label>
          <textarea
            id="configDescription"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t('config.descriptionPlaceholder')}
            rows={2}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="configProviderType" className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.providerType')} <span className="text-red-500">*</span></label>
          <Dropdown
            options={[{ value: 'openai', label: 'OpenAI' }, { value: 'anthropic', label: 'Anthropic' }, { value: 'ollama', label: 'Ollama' }]}
            value={formData.type || 'openai'}
            onChange={(v) => {
              const newType = v as 'openai' | 'anthropic' | 'ollama';
              const updates: Partial<LLMConfig> = { type: newType, model: '' };
              if (newType === 'ollama') {
                // 切换到 Ollama：自动填充默认地址
                updates.baseUrl = 'http://localhost:11434';
              } else if (formData.baseUrl === 'http://localhost:11434') {
                // 从 Ollama 切换到其他：清除 Ollama 地址
                updates.baseUrl = '';
              }
              setFormData({ ...formData, ...updates });
            }}
          />
        </div>

        <div>
          <label htmlFor="configBaseUrl" className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.baseUrl')} <span className="text-red-500">*</span></label>
          <input
            id="configBaseUrl"
            type="text"
            value={formData.baseUrl || ''}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder={formData.type === 'openai' ? 'https://api.openai.com/v1' : formData.type === 'ollama' ? 'http://localhost:11434' : 'https://api.anthropic.com/v1'}
            className={inputClass}
          />
        </div>

        {formData.type !== 'ollama' && (
          <div>
            <label htmlFor="configApiKey" className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.apiKey')} <span className="text-red-500">*</span></label>
            <input
              id="configApiKey"
              type="password"
              value={formData.apiKey || ''}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-..."
              className={inputClass}
            />
          </div>
        )}

        <div>
          <button
            onClick={handleLoadModels}
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-xl transition-all duration-200 font-medium disabled:opacity-50"
          >
            {loading ? t('config.loadingModels') : (formData.type === 'ollama' ? t('config.detectOllama') : t('config.loadModels'))}
          </button>
        </div>

        <div>
          <label htmlFor="configModel" className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.model')} <span className="text-red-500">*</span></label>
          {models.length > 0 && (
            <div className="mb-2 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modelSelection"
                  checked={!useCustomModel}
                  onChange={() => { setUseCustomModel(false); if (models.length > 0) setFormData({ ...formData, model: models[0].id }); }}
                />
                <span className="text-sm text-[var(--fg)]">{t('config.selectFromList')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modelSelection"
                  checked={useCustomModel}
                  onChange={() => { setUseCustomModel(true); setFormData({ ...formData, model: '' }); }}
                />
                <span className="text-sm text-[var(--fg)]">{t('config.manualInput')}</span>
              </label>
            </div>
          )}
          {models.length > 0 && !useCustomModel && (
            <Dropdown
              options={models.map(m => ({ value: m.id, label: m.name }))}
              value={formData.model || ''}
              onChange={(v) => setFormData({ ...formData, model: v })}
            />
          )}
          {(useCustomModel || models.length === 0) && (
            <input
              id="configModel"
              type="text"
              value={formData.model || ''}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder={t('config.modelPlaceholder')}
              className={inputClass}
            />
          )}
        </div>

        <div>
          <label htmlFor="configTemperature" className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('config.temperature')}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="configTemperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={formData.temperature ?? 0.5}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-[var(--surface-warm-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-indigo)]"
            />
            <span className="text-sm font-mono text-[var(--fg)] w-10 text-right">
              {(formData.temperature ?? 0.5).toFixed(1)}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">{t('config.temperatureHint')}</p>
        </div>

        <div>
          <label htmlFor="configMaxTokens" className="block text-sm font-medium text-[var(--fg)] mb-1.5">
            {t('config.maxTokens')}
          </label>
          <input
            id="configMaxTokens"
            type="number"
            min="256"
            max="200000"
            step="256"
            value={formData.maxTokens ?? ''}
            onChange={(e) => setFormData({ ...formData, maxTokens: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            placeholder={t('config.maxTokensPlaceholder')}
            className={inputClass}
          />
          <p className="text-xs text-[var(--muted)] mt-1">{t('config.maxTokensHint')}</p>
        </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex justify-end gap-3 px-7 py-4 border-t border-[var(--surface-warm-hover)] flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-xl transition-all duration-200"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] transition-all duration-200 font-medium"
          >
            {isCreating ? t('common.create') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
