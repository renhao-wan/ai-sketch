'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as api from '@/lib/api/client';
import { useNotification } from '@/lib/contexts/NotificationContext';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import ScrollToTop from '@/components/ui/ScrollToTop';
import OllamaBanner from './OllamaBanner';
import VisionConfigPanel from './VisionConfigPanel';
import ConfigEditor from './ConfigEditor';
import { Plus, Download, Upload, TestTube, Edit3, Copy, Trash2, Check, Search, X, Loader2, Tag, Eye } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';
import CountBanner from '@/components/ui/CountBanner';
import { useCountBanner } from '@/hooks/useCountBanner';
import TagBadge from '@/components/ui/TagBadge';
import TagCloudSelector from '@/components/ui/TagCloudSelector';
import TagFilter from '@/components/ui/TagFilter';
import type { LLMConfig, ConfirmDialogState, ConfigTag } from '@/lib/types';

/**
 * LLM 配置管理组件（主容器）
 * 负责状态管理和布局编排，具体功能拆分到子组件：
 * - OllamaBanner: Ollama 检测提示
 * - VisionConfigPanel: Vision API 配置页面
 * - ConfigEditor: 配置编辑表单
 */
export function LLMSettings({ isVisible = true }: { isVisible?: boolean } = {}) {
  const { t } = useLocale();
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<LLMConfig> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [testingConfigId, setTestingConfigId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, title: '', message: '', onConfirm: null });
  const [ollamaDetected, setOllamaDetected] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<{ id: string; name: string }[]>([]);
  const [ollamaCreating, setOllamaCreating] = useState(false);
  const [tags, setTags] = useState<ConfigTag[]>([]);
  const [configTagsMap, setConfigTagsMap] = useState<Record<string, ConfigTag[]>>({});
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [showTagSelector, setShowTagSelector] = useState<string | null>(null); // configId
  const tagTriggerRef = useRef<HTMLButtonElement>(null);
  const [visionPage, setVisionPage] = useState(false);

  const { showBanner, handleDismissBanner } = useCountBanner({
    count: configs.length,
    threshold: 15,
    storageKey: 'config-banner-dismissed',
  });

  /** 加载配置列表 */
  const loadConfigs = async () => {
    try {
      const data = await api.fetchConfigs();
      setConfigs(data.configs);
      setActiveConfigId(data.activeConfigId);
    } catch (err) {
      showNotification(t('config.loadFailed'), (err as Error).message, 'error');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在挂载时加载配置
  useEffect(() => { loadConfigs(); }, []);

  // 当组件变为不可见时，关闭标签选择器和编辑器
  useEffect(() => {
    if (!isVisible) {
      setShowTagSelector(null);
      setEditingConfig(null);
      setIsCreating(false);
      setVisionPage(false);
    }
  }, [isVisible]);

  // 检测本地 Ollama 服务（仅挂载时检测一次，不依赖配置加载结果）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 先检测 Ollama 服务（使用默认 URL，不依赖配置加载）
      let detectedModels: { id: string; name: string }[] = [];
      try {
        const res = await fetch('/api/ollama/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!cancelled && data.detected && data.models?.length > 0) {
          detectedModels = data.models;
        }
      } catch {
        // 检测失败，跳过
      }

      if (cancelled || detectedModels.length === 0) return;

      // 过滤掉已有配置的模型
      try {
        const currentConfigs = await api.fetchConfigs();
        const existingModels = new Set(
          currentConfigs.configs.filter(c => c.type === 'ollama').map(c => c.model),
        );
        const newModels = detectedModels.filter(m => !existingModels.has(m.id));
        if (!cancelled && newModels.length > 0) {
          setOllamaDetected(true);
          setOllamaModels(newModels);
        }
      } catch {
        // 配置加载失败时，仍然显示检测到的模型（让用户手动选择）
        if (!cancelled && detectedModels.length > 0) {
          setOllamaDetected(true);
          setOllamaModels(detectedModels);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 加载标签
  useEffect(() => {
    const loadTags = async () => {
      try {
        const cfgTags = await api.fetchConfigTags();
        setTags(cfgTags);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    };
    loadTags();
  }, []);

  // 批量加载配置标签
  useEffect(() => {
    if (configs.length === 0) return;
    const ids = configs.map(c => c.id!).filter(Boolean);
    api.fetchConfigTagsBatch(ids).then(setConfigTagsMap).catch(() => {});
  }, [configs]);

  /** 新建配置 */
  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingConfig({ name: '', type: 'openai', baseUrl: '', apiKey: '', model: '', description: '', temperature: 0.5 });
  };

  /** 编辑配置 */
  const handleEdit = (config: LLMConfig) => {
    setIsCreating(false);
    setEditingConfig({ ...config });
  };

  /** 删除配置（需确认） */
  const handleDelete = async (configId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('config.confirmDelete'),
      message: t('config.confirmDeleteMsg'),
      onConfirm: async () => {
        try {
          await api.deleteConfig(configId);
          await loadConfigs();
          showNotification(t('config.deleteSuccess'), t('config.deleteSuccessMsg'), 'success');
        } catch (err) {
          showNotification(t('config.deleteFailed'), (err as Error).message, 'error');
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  /** 克隆配置 */
  const handleClone = async (config: LLMConfig) => {
    try {
      await api.cloneConfig(config.id!);
      await loadConfigs();
    } catch (err) {
      showNotification(t('config.cloneFailed'), (err as Error).message, 'error');
    }
  };

  /** 设为活跃配置 */
  const handleSetActive = async (configId: string) => {
    try {
      await api.setActiveConfig(configId);
      await loadConfigs();
    } catch (err) {
      showNotification(t('config.switchFailed'), (err as Error).message, 'error');
    }
  };

  /** 测试连接 */
  const handleTestConnection = async (config: LLMConfig) => {
    setTestingConfigId(config.id!);
    try {
      const result = await api.testConnection(config);
      showNotification(
        result.success ? t('config.testSuccess') : t('config.testFailed'),
        result.message,
        result.success ? 'success' : 'error',
      );
    } catch (err) {
      showNotification(t('config.testFailed'), (err as Error).message, 'error');
    } finally {
      setTestingConfigId(null);
    }
  };

  /** 保存配置（新建或更新） */
  const handleSaveConfig = async (configData: Partial<LLMConfig>) => {
    try {
      if (isCreating) {
        await api.createConfig(configData);
      } else {
        await api.updateConfig(editingConfig!.id!, configData);
      }
      setEditingConfig(null);
      setIsCreating(false);
      await loadConfigs();
    } catch (err) {
      showNotification(t('config.saveFailed'), (err as Error).message, 'error');
    }
  };

  /** 导出配置为 JSON 文件 */
  const handleExport = async () => {
    try {
      const json = await api.exportConfigs();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'llm-configs.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotification(t('config.exportFailed'), (err as Error).message, 'error');
    }
  };

  /** 从 JSON 文件导入配置 */
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const result = await api.importConfigs(text);
        if (result.success) {
          showNotification(
            t('config.importSuccess'),
            `${t('config.imported')} ${result.count} ${t('config.importedCount')}`,
            'success',
          );
          await loadConfigs();
        } else {
          showNotification(t('config.importFailed'), result.message, 'error');
        }
      } catch (err) {
        showNotification(t('config.importFailed'), (err as Error).message, 'error');
      }
    };
    input.click();
  };

  /** 快速添加 Ollama 配置 */
  const handleAddOllama = async () => {
    if (ollamaCreating) return;
    setOllamaCreating(true);
    try {
      const existingNames = new Set(configs.map(c => c.name));

      for (const model of ollamaModels) {
        let name = `Ollama - ${model.name}`;
        let counter = 1;
        while (existingNames.has(name)) {
          name = `Ollama - ${model.name} (${counter})`;
          counter++;
        }
        existingNames.add(name);

        await api.createConfig({
          name,
          type: 'ollama',
          baseUrl: 'http://localhost:11434',
          apiKey: '',
          model: model.id,
          description: t('config.ollamaDefaultDesc'),
        });
      }

      setOllamaDetected(false);
      await loadConfigs();
      showNotification(
        t('config.ollamaDetected'),
        t('config.ollamaBatchCreated', { count: ollamaModels.length }),
        'success',
      );
    } catch (err) {
      showNotification(t('config.saveFailed'), (err as Error).message, 'error');
    } finally {
      setOllamaCreating(false);
    }
  };

  /** 根据搜索关键词过滤配置，并将活跃配置置顶 */
  const filteredConfigs = useMemo(() => {
    let result = searchQuery
      ? configs.filter(c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.type.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : configs;

    if (selectedTagId) {
      result = result.filter(c => {
        const cfgTags = configTagsMap[c.id!] || [];
        return cfgTags.some(tag => tag.id === selectedTagId);
      });
    }

    return result.sort((a, b) => (a.id === activeConfigId ? -1 : b.id === activeConfigId ? 1 : 0));
  }, [configs, searchQuery, activeConfigId, selectedTagId, configTagsMap]);

  return (
    <div className="h-full flex flex-col">
      {/* 固定头部：Banner + 操作栏 + 搜索 */}
      <div className="flex-shrink-0 space-y-4 mb-4">
        {/* 数量提示 Banner */}
        <CountBanner
          show={showBanner}
          title={t('config.bannerTitle')}
          description={t('config.bannerDescription', { count: configs.length })}
          onDismiss={handleDismissBanner}
        />

        {/* Ollama 检测 Banner */}
        {ollamaDetected && (
          <OllamaBanner
            models={ollamaModels}
            creating={ollamaCreating}
            onAdd={handleAddOllama}
          />
        )}

        {/* 操作栏 */}
        {!visionPage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] transition-all duration-200 font-medium"
            >
              <Plus size={14} /><span>{t('config.new')}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--muted)] bg-[var(--surface-warm-hover)] hover:bg-[var(--border)] rounded-xl transition-all duration-200"
            >
              <Download size={14} /><span>{t('common.export')}</span>
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--muted)] bg-[var(--surface-warm-hover)] hover:bg-[var(--border)] rounded-xl transition-all duration-200"
            >
              <Upload size={14} /><span>{t('common.import')}</span>
            </button>
            <button
              onClick={() => setVisionPage(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--muted)] bg-[var(--surface-warm-hover)] hover:bg-[var(--border)] rounded-xl transition-all duration-200"
            >
              <Eye size={14} /><span>{t('settings.vision')}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 视觉模型配置页面 ── */}
      {visionPage && (
        <VisionConfigPanel onBack={() => setVisionPage(false)} />
      )}

      {/* 搜索框 + 标签筛选 */}
      {!visionPage && (
      <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('config.search')}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--surface-warm-hover)] border border-[var(--border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/30 transition-all duration-200"
          />
        </div>
        <TagFilter
          tags={tags}
          selectedTagId={selectedTagId}
          onChange={setSelectedTagId}
        />
      </div>

      {/* 可滚动的配置列表 */}
      <ScrollToTop className="flex-1 overflow-y-auto scrollbar-thin pt-2">
        <div className="space-y-2">
          {filteredConfigs.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--muted)]">
              {searchQuery ? t('config.noMatch') : t('config.noConfig')}
            </div>
          ) : (
            filteredConfigs.map((config) => {
              const cfgTags = configTagsMap[config.id!] || [];
              return (
                <div
                key={config.id}
                className={`group p-4 rounded-2xl border transition-all duration-200 ${
                  config.id === activeConfigId
                    ? 'border-[var(--accent-indigo)]/30 bg-[var(--accent-indigo)]/5'
                    : 'border-transparent bg-[var(--surface-warm-hover)] hover:bg-[var(--border)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--fg)] truncate">{config.name}</h3>
                      {config.id === activeConfigId && (
                        <span className="px-2 py-0.5 text-[11px] font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded-lg flex-shrink-0">
                          {t('config.active')}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-[11px] bg-[var(--surface-warm-hover)] text-[var(--muted)] rounded-lg flex-shrink-0">
                        {config.type}
                      </span>
                      {cfgTags.length > 0 && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          {cfgTags.slice(0, 5).map(tag => (
                            <TagBadge key={tag.id} name={tag.name} color={tag.color} variant="dot" />
                          ))}
                        </span>
                      )}
                    </div>
                    {config.description && (
                      <p className="text-xs text-[var(--muted)] mb-1.5 truncate">{config.description}</p>
                    )}
                    <div className="text-[11px] text-[var(--muted)]/70 space-y-0.5">
                      <div className="truncate">URL: {config.baseUrl}</div>
                      <div className="truncate">{t('config.modelPrefix')} {config.model}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {config.id !== activeConfigId && (
                      <Tooltip content={t('config.setActive')} side="top">
                        <button
                          onClick={() => handleSetActive(config.id!)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 transition-all duration-200"
                        >
                          <Check size={14} />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip content={t('config.testConnection')} side="top">
                      <button
                        onClick={() => handleTestConnection(config)}
                        disabled={testingConfigId !== null}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 transition-all duration-200 disabled:opacity-50"
                      >
                        {testingConfigId === config.id ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
                      </button>
                    </Tooltip>
                    <Tooltip content={t('common.edit')} side="top">
                      <button
                        onClick={() => handleEdit(config)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                      >
                        <Edit3 size={14} />
                      </button>
                    </Tooltip>
                    <Tooltip content={t('config.clone')} side="top">
                      <button
                        onClick={() => handleClone(config)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                      >
                        <Copy size={14} />
                      </button>
                    </Tooltip>
                    <Tooltip content={t('tags.selectTags')} side="top">
                      <button
                        ref={showTagSelector === config.id ? tagTriggerRef : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTagSelector(showTagSelector === config.id ? null : config.id!);
                        }}
                        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
                          cfgTags.length > 0
                            ? 'text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10'
                            : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                        }`}
                      >
                        <Tag size={14} />
                        {cfgTags.length > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold text-white bg-[var(--accent-indigo)] rounded-full">
                            {cfgTags.length}
                          </span>
                        )}
                      </button>
                    </Tooltip>
                    {configs.length > 1 && (
                      <Tooltip content={t('common.delete')} side="top">
                        <button
                          onClick={() => handleDelete(config.id!)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-all duration-200"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </ScrollToTop>
      </>
      )}

      {/* 标签选择器（portal 渲染） */}
      {showTagSelector && (() => {
        const config = configs.find(c => c.id === showTagSelector);
        if (!config) return null;
        const cfgTags = configTagsMap[config.id!] || [];
        return (
          <TagCloudSelector
            tags={tags}
            selectedTagIds={cfgTags.map(t => t.id)}
            onChange={async (tagIds) => {
              try {
                const result = await api.setConfigTags(config.id!, tagIds);
                setConfigTagsMap(prev => ({ ...prev, [config.id!]: result.tags }));
              } catch (err) {
                console.error('Failed to update config tags:', err);
              }
            }}
            onClose={() => setShowTagSelector(null)}
            triggerRef={tagTriggerRef}
          />
        );
      })()}

      {/* 配置编辑器弹窗 */}
      {editingConfig && (
        <ConfigEditor
          config={editingConfig}
          isCreating={isCreating}
          onSave={handleSaveConfig}
          onCancel={() => { setEditingConfig(null); setIsCreating(false); }}
        />
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm ?? (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
}
