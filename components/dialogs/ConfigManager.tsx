'use client';

import { useState, useEffect } from 'react';
import * as api from '@/lib/api-client';
import Notification from '../Notification';
import ConfirmDialog from './ConfirmDialog';
import ScrollToTop from '../ScrollToTop';
import { Settings, Plus, Download, Upload, TestTube, Edit3, Copy, Trash2, Check, Search, X, Loader2 } from 'lucide-react';
import Dropdown from '../ui/Dropdown';
import { useLocale } from '@/locales';
import type { LLMConfig, ModelInfo, NotificationState, ConfirmDialogState } from '@/types';

interface ConfigManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSelect?: (config: LLMConfig | null) => void;
}

interface ConfigEditorProps {
  config: Partial<LLMConfig>;
  isCreating: boolean;
  onSave: (config: Partial<LLMConfig>) => void;
  onCancel: () => void;
}

export default function ConfigManager({ isOpen, onClose, onConfigSelect }: ConfigManagerProps) {
  const { t } = useLocale();
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<LLMConfig> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<NotificationState>({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => { if (isOpen) loadConfigs(); }, [isOpen]);

  const loadConfigs = async () => {
    try {
      const data = await api.fetchConfigs();
      setConfigs(data.configs);
      setActiveConfigId(data.activeConfigId);
    } catch (err) {
      setError(t('config.loadFailed') + (err as Error).message);
    }
  };

  const handleCreateNew = () => { setIsCreating(true); setEditingConfig({ name: '', type: 'openai', baseUrl: '', apiKey: '', model: '', description: '' }); };
  const handleEdit = (config: LLMConfig) => { setIsCreating(false); setEditingConfig({ ...config }); };

  const handleDelete = async (configId: string) => {
    setConfirmDialog({
      isOpen: true, title: t('config.confirmDelete'), message: t('config.confirmDeleteMsg'),
      onConfirm: async () => {
        try {
          await api.deleteConfig(configId);
          await loadConfigs();
          setError('');
          setNotification({ isOpen: true, title: t('config.deleteSuccess'), message: t('config.deleteSuccessMsg'), type: 'success' });
        } catch (err) { setError(t('config.deleteFailed') + (err as Error).message); }
      },
    });
  };

  const handleClone = async (config: LLMConfig) => {
    try {
      await api.cloneConfig(config.id!, `${config.name} ${t('config.cloneSuffix')}`);
      await loadConfigs();
      setError('');
    } catch (err) { setError(t('config.cloneFailed') + (err as Error).message); }
  };

  const handleSetActive = async (configId: string) => {
    try {
      await api.setActiveConfig(configId);
      await loadConfigs();
      onConfigSelect?.(configs.find(c => c.id === configId) || null);
      setError('');
    } catch (err) { setError(t('config.switchFailed') + (err as Error).message); }
  };

  const handleTestConnection = async (config: LLMConfig) => {
    setIsLoading(true); setError('');
    try {
      const result = await api.testConnection(config);
      setNotification({ isOpen: true, title: result.success ? t('config.testSuccess') : t('config.testFailed'), message: result.message, type: result.success ? 'success' : 'error' });
    } catch (err) { setNotification({ isOpen: true, title: t('config.testFailed'), message: (err as Error).message, type: 'error' }); }
    finally { setIsLoading(false); }
  };

  const handleSaveConfig = async (configData: Partial<LLMConfig>) => {
    try {
      if (isCreating) {
        const newConfig = await api.createConfig(configData);
        if (configs.length === 0) onConfigSelect?.(newConfig);
      } else {
        await api.updateConfig(editingConfig!.id!, configData);
        if (editingConfig!.id === activeConfigId) {
          onConfigSelect?.({ ...editingConfig!, ...configData } as LLMConfig);
        }
      }
      setEditingConfig(null); setIsCreating(false); await loadConfigs(); setError('');
    } catch (err) { setError(t('config.saveFailed') + (err as Error).message); }
  };

  const handleExport = async () => {
    try {
      const json = await api.exportConfigs();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'llm-configs.json'; a.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(t('config.exportFailed') + (err as Error).message); }
  };

  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
      try {
        const text = await file.text();
        const result = await api.importConfigs(text);
        if (result.success) {
          setNotification({ isOpen: true, title: t('config.importSuccess'), message: `${t('config.imported')} ${result.count} ${t('config.importedCount')}`, type: 'success' });
          await loadConfigs();
        } else { setError(t('config.importFailed') + result.message); }
      } catch (err) { setError(t('config.importFailed') + (err as Error).message); }
    };
    input.click();
  };

  const filteredConfigs = (searchQuery
    ? configs.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.type.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : configs
  ).sort((a, b) => (a.id === activeConfigId ? -1 : b.id === activeConfigId ? 1 : 0));

  if (!isOpen) return null;

  if (editingConfig) {
    return <ConfigEditor config={editingConfig} isCreating={isCreating} onSave={handleSaveConfig} onCancel={() => { setEditingConfig(null); setIsCreating(false); }} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--surface-warm-hover)]0 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface-warm)] backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-[var(--muted)]" />
            <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">{t('config.title')}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200">
            <X size={18} />
          </button>
        </div>

        {/* Fixed Actions + Search */}
        <div className="px-7 pb-3 flex-shrink-0 space-y-3">
          {error && <div className="px-4 py-3 bg-red-500/10 rounded-xl"><p className="text-sm text-red-700">{error}</p></div>}
          <div className="flex flex-wrap gap-2">
            <button onClick={handleCreateNew} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] transition-all duration-200 font-medium">
              <Plus size={14} /><span>{t('config.new')}</span>
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--muted)] bg-[var(--surface-warm-hover)] hover:bg-[var(--surface-warm-hover)] rounded-xl transition-all duration-200">
              <Download size={14} /><span>{t('common.export')}</span>
            </button>
            <button onClick={handleImport} className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--muted)] bg-[var(--surface-warm-hover)] hover:bg-[var(--surface-warm-hover)] rounded-xl transition-all duration-200">
              <Upload size={14} /><span>{t('common.import')}</span>
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]/50" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('config.search')} className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200" />
          </div>
        </div>

        {/* Scrollable List */}
        <ScrollToTop className="px-7 pb-6 scrollbar-thin">
          <div className="space-y-2">
            {filteredConfigs.length === 0 ? (
              <div className="text-center py-12 text-sm text-[var(--muted)]">{searchQuery ? t('config.noMatch') : t('config.noConfig')}</div>
            ) : filteredConfigs.map((config) => (
              <div key={config.id} className={`group p-4 rounded-2xl border transition-all duration-200 ${config.id === activeConfigId ? 'border-[var(--accent-indigo)]/30 bg-[var(--accent-indigo)]/5' : 'border-transparent bg-[var(--surface-warm-hover)] hover:bg-[var(--surface-warm-hover)]'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-[var(--fg)]">{config.name}</h3>
                      {config.id === activeConfigId && <span className="px-2 py-0.5 text-[11px] font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded-lg">{t('config.active')}</span>}
                      <span className="px-2 py-0.5 text-[11px] bg-[var(--surface-warm-hover)] text-[var(--muted)] rounded-lg">{config.type}</span>
                    </div>
                    {config.description && <p className="text-xs text-[var(--muted)] mb-1.5">{config.description}</p>}
                    <div className="text-[11px] text-[var(--muted)]/70 space-y-0.5">
                      <div>URL: {config.baseUrl}</div>
                      <div>{t('config.modelPrefix')} {config.model}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {config.id !== activeConfigId && (
                      <button onClick={() => handleSetActive(config.id!)} title={t('config.setActive')} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 transition-all duration-200">
                        <Check size={14} />
                      </button>
                    )}
                    <button onClick={() => handleTestConnection(config)} disabled={isLoading} title={t('config.testConnection')} className="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-all duration-200 disabled:opacity-50">
                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
                    </button>
                    <button onClick={() => handleEdit(config)} title={t('common.edit')} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleClone(config)} title={t('config.clone')} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200">
                      <Copy size={14} />
                    </button>
                    {configs.length > 1 && (
                      <button onClick={() => handleDelete(config.id!)} title={t('common.delete')} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-all duration-200">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollToTop>
      </div>

      <Notification isOpen={notification.isOpen} onClose={() => setNotification({ ...notification, isOpen: false })} title={notification.title} message={notification.message} type={notification.type} />
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} onConfirm={() => { confirmDialog.onConfirm?.(); setConfirmDialog({ ...confirmDialog, isOpen: false }); }} title={confirmDialog.title} message={confirmDialog.message} type="danger" />
    </div>
  );
}

function ConfigEditor({ config, isCreating, onSave, onCancel }: ConfigEditorProps) {
  const { t } = useLocale();
  const [formData, setFormData] = useState<Partial<LLMConfig>>({ ...config });
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { if (formData.model) { if (models.length > 0) setUseCustomModel(!models.some(m => m.id === formData.model)); else setUseCustomModel(true); } }, [models, formData.model]);

  const handleLoadModels = async () => {
    if (!formData.type || !formData.baseUrl || !formData.apiKey) { setError(t('config.fillRequired')); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ type: formData.type, baseUrl: formData.baseUrl, apiKey: formData.apiKey });
      const response = await fetch(`/api/models?${params}`); const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('config.loadModelFailed'));
      setModels(data.models);
    } catch (err) { setError((err as Error).message); setModels([]); }
    finally { setLoading(false); }
  };

  const handleSave = () => {
    if (!formData.name || !formData.type || !formData.baseUrl || !formData.apiKey || !formData.model) { setError(t('config.fillAllRequired')); return; }
    onSave(formData);
  };

  const inputClass = "w-full px-4 py-2.5 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--surface-warm-hover)]0 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--surface-warm)] backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[0_20px_60px_rgba(28,25,23,0.10)] w-full max-w-md max-h-[78vh] flex flex-col animate-slide-up">
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">{isCreating ? t('config.new') : t('config.edit')}</h2>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-7 pb-6 space-y-4 overflow-y-auto scrollbar-hide flex-1 min-h-0">
          {error && <div className="px-4 py-3 bg-red-500/10 rounded-xl"><p className="text-sm text-red-700">{error}</p></div>}

          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.configName')} <span className="text-red-500">*</span></label>
            <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('config.configNamePlaceholder')} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.description')}</label>
            <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={t('config.descriptionPlaceholder')} rows={2} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.providerType')} <span className="text-red-500">*</span></label>
            <Dropdown
              options={[{ value: 'openai', label: 'OpenAI' }, { value: 'anthropic', label: 'Anthropic' }]}
              value={formData.type || 'openai'}
              onChange={(v) => setFormData({ ...formData, type: v as 'openai' | 'anthropic', model: '' })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.baseUrl')} <span className="text-red-500">*</span></label>
            <input type="text" value={formData.baseUrl || ''} onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })} placeholder={formData.type === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1'} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.apiKey')} <span className="text-red-500">*</span></label>
            <input type="password" value={formData.apiKey || ''} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} placeholder="sk-..." className={inputClass} />
          </div>
          <div>
            <button onClick={handleLoadModels} disabled={loading} className="w-full px-4 py-2.5 text-sm text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-xl transition-all duration-200 font-medium disabled:opacity-50">
              {loading ? t('config.loadingModels') : t('config.loadModels')}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('config.model')} <span className="text-red-500">*</span></label>
            {models.length > 0 && (
              <div className="mb-2 flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={!useCustomModel} onChange={() => { setUseCustomModel(false); if (models.length > 0) setFormData({ ...formData, model: models[0].id }); }} /><span className="text-sm text-[var(--fg)]">{t('config.selectFromList')}</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={useCustomModel} onChange={() => { setUseCustomModel(true); setFormData({ ...formData, model: '' }); }} /><span className="text-sm text-[var(--fg)]">{t('config.manualInput')}</span></label>
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
              <input type="text" value={formData.model || ''} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder={t('config.modelPlaceholder')} className={inputClass} />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-7 py-4 border-t border-[var(--surface-warm-hover)] flex-shrink-0">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-xl transition-all duration-200">{t('common.cancel')}</button>
          <button onClick={handleSave} className="px-5 py-2 text-sm text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] transition-all duration-200 font-medium">{isCreating ? t('common.create') : t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}
