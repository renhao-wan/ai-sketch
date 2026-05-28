'use client';

import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import type { LLMConfig, ModelInfo } from '@/types';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Partial<LLMConfig>) => void;
  initialConfig?: Partial<LLMConfig>;
  showManager?: boolean;
}

export default function ConfigModal({ isOpen, onClose, onSave, initialConfig }: ConfigModalProps) {
  const [config, setConfig] = useState<Partial<LLMConfig>>({ name: '', type: 'openai', baseUrl: '', apiKey: '', model: '' });
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);

  useEffect(() => { if (initialConfig) setConfig(initialConfig); }, [initialConfig]);
  useEffect(() => { if (config.model) { if (models.length > 0) setUseCustomModel(!models.some(m => m.id === config.model)); else setUseCustomModel(true); } }, [models, config.model]);

  const handleLoadModels = async () => {
    if (!config.type || !config.baseUrl || !config.apiKey) { setError('请先填写提供商类型、基础 URL 和 API 密钥'); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ type: config.type, baseUrl: config.baseUrl, apiKey: config.apiKey });
      const response = await fetch(`/api/models?${params}`); const data = await response.json();
      if (!response.ok) throw new Error(data.error || '加载模型失败');
      setModels(data.models);
      if (data.models.length > 0) {
        if (config.model && !data.models.some((m: ModelInfo) => m.id === config.model)) { setUseCustomModel(false); setConfig(prev => ({ ...prev, model: data.models[0].id })); }
        else if (!config.model && !useCustomModel) setConfig(prev => ({ ...prev, model: data.models[0].id }));
      }
    } catch (err) { setError((err as Error).message); setModels([]); }
    finally { setLoading(false); }
  };

  const handleSave = () => {
    if (!config.type || !config.baseUrl || !config.apiKey || !config.model) { setError('请填写所有必填字段'); return; }
    onSave(config); onClose();
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-2.5 text-sm bg-black/4 border border-black/5 rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-[0_20px_60px_rgba(15,23,42,0.12)] w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-7 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-[var(--muted)]" />
            <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">LLM 配置</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200">
            <X size={18} />
          </button>
        </div>

        <div className="px-7 pb-6 space-y-4">
          {error && <div className="px-4 py-3 bg-red-500/10 rounded-xl"><p className="text-sm text-red-700">{error}</p></div>}
          <div><label className="block text-sm font-medium text-[var(--fg)] mb-1.5">提供商名称</label><input type="text" value={config.name || ''} onChange={(e) => setConfig({ ...config, name: e.target.value })} placeholder="例如：我的 OpenAI" className={inputClass} /></div>
          <div><label className="block text-sm font-medium text-[var(--fg)] mb-1.5">提供商类型 <span className="text-red-500">*</span></label><select value={config.type} onChange={(e) => setConfig({ ...config, type: e.target.value as 'openai' | 'anthropic', model: '' })} className={inputClass}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></div>
          <div><label className="block text-sm font-medium text-[var(--fg)] mb-1.5">基础 URL <span className="text-red-500">*</span></label><input type="text" value={config.baseUrl || ''} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder={config.type === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1'} className={inputClass} /></div>
          <div><label className="block text-sm font-medium text-[var(--fg)] mb-1.5">API 密钥 <span className="text-red-500">*</span></label><input type="password" value={config.apiKey || ''} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="sk-..." className={inputClass} /></div>
          <div><button onClick={handleLoadModels} disabled={loading} className="w-full px-4 py-2.5 text-sm text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-xl transition-all duration-200 font-medium disabled:opacity-50">{loading ? '加载模型中...' : '加载可用模型'}</button></div>
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">模型 <span className="text-red-500">*</span></label>
            <p className="text-xs text-[var(--muted)] mb-2">推荐 claude-sonnet-4.5</p>
            {models.length > 0 && (
              <div className="mb-2 flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={!useCustomModel} onChange={() => { setUseCustomModel(false); if (models.length > 0) setConfig({ ...config, model: models[0].id }); }} /><span className="text-sm text-[var(--fg)]">从列表选择</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={useCustomModel} onChange={() => { setUseCustomModel(true); setConfig({ ...config, model: '' }); }} /><span className="text-sm text-[var(--fg)]">手动输入</span></label>
              </div>
            )}
            {models.length > 0 && !useCustomModel && <select value={config.model || ''} onChange={(e) => setConfig({ ...config, model: e.target.value })} className={inputClass}>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}
            {(useCustomModel || models.length === 0) && <input type="text" value={config.model || ''} onChange={(e) => setConfig({ ...config, model: e.target.value })} placeholder="例如：gpt-4、claude-3-opus" className={inputClass} />}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-7 py-4 border-t border-black/5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-xl transition-all duration-200">取消</button>
          <button onClick={handleSave} className="px-5 py-2 text-sm text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] transition-all duration-200 font-medium">保存配置</button>
        </div>
      </div>
    </div>
  );
}
