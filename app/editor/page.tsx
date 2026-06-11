'use client';

import { useState, useEffect, useCallback, useRef, useReducer, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { AppIcon } from '@/components/layout/TopBar';
import AICopilotPanel from '@/components/ai/AICopilotPanel';
import EditorTopBar from '@/components/layout/EditorTopBar';
import FloatingAIActions from '@/components/ai/FloatingAIActions';
import CodeEditor from '@/components/editor/CodeEditor';
import { useNotification } from '@/lib/contexts/NotificationContext';
import DiagramCanvas from '@/components/canvases/DiagramCanvas';
import type { CanvasExportHandle } from '@/components/canvases/DiagramCanvas';
import type { StreamRendererRef } from '@/components/canvases/ExcalidrawCanvas';
import { downloadBlob, getFileExtension, getMimeType, type ExportFormat } from '@/lib/utils/export-diagram';
import * as api from '@/lib/api/client';
import { isConfigValid } from '@/lib/api/config-validator';
import { getStrategy } from '@/lib/strategies/registry';
import { consumeInitData } from '@/lib/utils/init-data';
import { useLocale } from '@/lib/locales';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useConversation } from '@/hooks/useConversation';
import { useGeneration } from '@/hooks/useGeneration';
import { useAIActions } from '@/hooks/useAIActions';
import type { LLMConfig } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import { detectCodeFormat } from '@/lib/utils/detect-code-format';

// 动态导入重型组件（按需加载）
const ConfigSelector = dynamic(() => import('@/components/dialogs/ConfigSelector'), { ssr: false });
const BottomContextPanel = dynamic(() => import('@/components/layout/BottomContextPanel'), { ssr: false });
const VersionHistoryDrawer = dynamic(() => import('@/components/version-history/VersionHistoryDrawer'), { ssr: false });

// --- Reducer 类型定义 ---

/** 配置状态 */
interface ConfigState {
  config: LLMConfig | null;
  loaded: boolean;
}
type ConfigAction =
  | { type: 'SET_CONFIG'; payload: LLMConfig | null }
  | { type: 'LOADED' };

function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case 'SET_CONFIG': return { ...state, config: action.payload };
    case 'LOADED': return { ...state, loaded: true };
    default: return state;
  }
}

/** 生成结果状态 */
interface GenerationResultState {
  code: string;
  renderData: unknown;
  jsonError: string | null;
}
type GenerationResultAction =
  | { type: 'SET_CODE'; payload: string }
  | { type: 'SET_RENDER_DATA'; payload: unknown }
  | { type: 'SET_JSON_ERROR'; payload: string | null }
  | { type: 'CLEAR' };

function generationResultReducer(state: GenerationResultState, action: GenerationResultAction): GenerationResultState {
  switch (action.type) {
    case 'SET_CODE': return { ...state, code: action.payload };
    case 'SET_RENDER_DATA': return { ...state, renderData: action.payload };
    case 'SET_JSON_ERROR': return { ...state, jsonError: action.payload };
    case 'CLEAR': return { code: '', renderData: null, jsonError: null };
    default: return state;
  }
}

function EditorContent() {
  const router = useRouter();
  const { t } = useLocale();

  // 配置状态（reducer）
  const [configState, dispatchConfig] = useReducer(configReducer, { config: null, loaded: false });
  const { config, loaded: configLoaded } = configState;

  // 生成结果状态（reducer）
  const [genResult, dispatchGenResult] = useReducer(generationResultReducer, { code: '', renderData: null, jsonError: null });
  const { code: generatedCode, renderData, jsonError } = genResult;

  // 独立状态（useState）
  const [format, setFormat] = useState<DiagramFormat>('excalidraw');
  const [isConfigManagerOpen, setIsConfigManagerOpen] = useState(false);
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [currentChartType, setCurrentChartType] = useState('auto');
  const { showNotification } = useNotification();
  const [bottomPanelTab, setBottomPanelTab] = useState('code');
  const [panelWidth, setPanelWidth] = useState(360);
  const [isElectron, setIsElectron] = useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Refs
  const pendingInitRef = useRef<import('@/lib/utils/init-data').InitData | null>(null);
  const pendingSourceRef = useRef<string>('text');
  const streamRendererRef = useRef<StreamRendererRef | null>(null);
  const canvasExportRef = useRef<CanvasExportHandle | null>(null);
  const formatRef = useRef(format);
  useEffect(() => { formatRef.current = format; }, [format]);
  const isFirstFormatRef = useRef(true);
  const skipFormatClearRef = useRef(false);

  // 检测是否在 Electron 环境中
  useEffect(() => {
    setIsElectron(!!window.electronAPI?.window);
  }, []);

  const handlePanelWidthChange = useCallback((w: number) => {
    const minWidth = isElectron ? 320 : 280;
    setPanelWidth(Math.min(Math.max(w, minWidth), 600));
  }, [isElectron]);

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      const data = await api.fetchConfigs();
      if (data.activeConfigId) {
        const active = data.configs.find(c => c.id === data.activeConfigId);
        if (active) dispatchConfig({ type: 'SET_CONFIG', payload: active });
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      dispatchConfig({ type: 'LOADED' });
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 会话管理 Hook
  const conversation = useConversation({
    onFormatChange: (f) => setFormat(f),
    onChartTypeChange: setCurrentChartType,
    onCodeClear: () => dispatchGenResult({ type: 'CLEAR' }),
    onError: (msg) => generation.setApiError(msg),
  });

  // 版本列表：从 messages 中提取 assistant 消息，推断每个版本的格式
  const versions = useMemo(() =>
    conversation.messages
      .filter(msg => msg.role === 'assistant')
      .map((msg, index) => ({
        id: msg.id,
        versionNumber: index + 1,
        createdAt: msg.createdAt,
        code: msg.content,
        format: detectCodeFormat(msg.content),
      })),
    [conversation.messages]
  );

  // 稳定的版本 ID 列表，避免引用变化导致 effect 频繁触发
  const versionsKey = useMemo(() =>
    conversation.messages
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.id)
      .join(','),
    [conversation.messages]
  );

  // 版本列表变化时清空当前版本选择
  useEffect(() => {
    setCurrentVersionId(null);
  }, [versionsKey]);

  // 代码生成 Hook
  const generation = useGeneration({
    config,
    format,
    conversationId: conversation.conversationId,
    streamRendererRef,
    onCodeUpdate: (code) => dispatchGenResult({ type: 'SET_CODE', payload: code }),
    onRenderDataUpdate: (data) => dispatchGenResult({ type: 'SET_RENDER_DATA', payload: data }),
    onJsonErrorUpdate: (err) => dispatchGenResult({ type: 'SET_JSON_ERROR', payload: err }),
    onConversationIdUpdate: conversation.setConversationId,
    onMessagesUpdate: conversation.setMessages,
    onConfigReminder: () => {
      showNotification(t('editor.configReminder'), t('editor.pleaseConfigLLM'), 'warning');
      setIsConfigManagerOpen(true);
    },
    onChartTypeUpdate: setCurrentChartType,
  });

  // AI 操作 Hook
  const aiActions = useAIActions({
    config,
    format,
    generatedCode,
    abortControllerRef: generation.abortControllerRef,
    onCodeUpdate: (code) => dispatchGenResult({ type: 'SET_CODE', payload: code }),
    onExplanationUpdate: (exp) => {}, // 已在 Hook 内部处理
    onBottomPanelTabChange: setBottomPanelTab,
    onRenderDataUpdate: (data) => dispatchGenResult({ type: 'SET_RENDER_DATA', payload: data }),
    onJsonErrorUpdate: (err) => dispatchGenResult({ type: 'SET_JSON_ERROR', payload: err }),
    onNotification: showNotification,
  });

  // 格式切换时清空代码
  useEffect(() => {
    if (isFirstFormatRef.current) { isFirstFormatRef.current = false; return; }
    if (skipFormatClearRef.current) { skipFormatClearRef.current = false; return; }
    dispatchGenResult({ type: 'CLEAR' });
    streamRendererRef.current?.reset();
  }, [format]);

  const strategy = getStrategy(format);

  // Load conversation from sessionStorage on mount
  useEffect(() => {
    const convId = sessionStorage.getItem('ai-sketch-load-conversation');
    if (!convId) return;
    sessionStorage.removeItem('ai-sketch-load-conversation');
    conversation.loadConversation(convId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume init data from sessionStorage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    if (!source) return;

    const init = consumeInitData();
    if (!init) return;

    if (init.format && ['excalidraw', 'mermaid', 'drawio'].includes(init.format)) {
      setFormat(init.format);
    }

    const data = init.data;
    if (init.type === 'text' && typeof data === 'string') {
      setCurrentInput(data);
      setCurrentChartType('auto');
    } else if (init.type === 'file' && data) {
      const text = typeof data === 'string' ? data : ((data as { text?: string }).text || '');
      setCurrentInput(text);
      setCurrentChartType('auto');
    } else if (init.type === 'image' && data) {
      const imgData = data as { text?: string; images?: unknown[] };
      setCurrentInput(imgData.text || '');
      setCurrentChartType('auto');
    }

    pendingInitRef.current = init;
    pendingSourceRef.current = source;
  }, []);

  // Send pending init data once config is loaded
  useEffect(() => {
    if (!pendingInitRef.current) return;
    if (!configLoaded) return;

    if (!isConfigValid(config)) {
      showNotification(t('editor.configReminder'), t('editor.pleaseConfigLLM'), 'warning');
      setIsConfigManagerOpen(true);
      return;
    }

    const init = pendingInitRef.current;
    pendingInitRef.current = null;

    const data = init.data;
    const resolvedSource = pendingSourceRef.current || (init.type === 'image' ? 'image' : init.type === 'file' ? 'file' : 'text');

    if (init.type === 'text' && typeof data === 'string') {
      generation.sendMessage(data, 'auto', resolvedSource);
    } else if (init.type === 'file' && data) {
      generation.sendMessage(data as string, 'auto', resolvedSource);
    } else if (init.type === 'image' && data) {
      generation.sendMessage(data as { text?: string; images?: unknown[] }, 'auto', 'image');
    }
    setCurrentInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, configLoaded]);

  const handleConfigSelect = (selectedConfig: LLMConfig | null) => {
    if (selectedConfig) dispatchConfig({ type: 'SET_CONFIG', payload: selectedConfig });
  };

  // 注册快捷键
  useShortcuts({
    onGoHome: () => router.push('/'),
    onNewConversation: conversation.newConversation,
    onOpenSettings: (tab) => router.push(tab ? `/settings?tab=${tab}` : '/settings'),
    onSwitchFormat: (f) => { setFormat(f); dispatchGenResult({ type: 'CLEAR' }); },
    onOpenVersionHistory: () => setVersionDrawerOpen(prev => !prev),
  });



  const handleShowDiagram = useCallback((content: string) => {
    const detectedFormat = detectCodeFormat(content);
    if (detectedFormat !== format) {
      skipFormatClearRef.current = true;
      setFormat(detectedFormat);
    }
    const strat = getStrategy(detectedFormat);
    const processed = strat.postProcess(content);
    const optimized = strat.optimize(processed);
    dispatchGenResult({ type: 'SET_CODE', payload: optimized });
    const result = strat.validate(optimized);
    if (result.valid) {
      dispatchGenResult({ type: 'SET_RENDER_DATA', payload: result.data });
      dispatchGenResult({ type: 'SET_JSON_ERROR', payload: null });
    } else {
      dispatchGenResult({ type: 'SET_JSON_ERROR', payload: result.error });
    }
  }, [format]);

  const handleSelectVersion = useCallback((versionId: string) => {
    const msg = conversation.messages.find(m => m.id === versionId);
    if (!msg) return;
    handleShowDiagram(msg.content);
    setCurrentVersionId(versionId);
  }, [conversation.messages, handleShowDiagram]);

  const handleCloseVersionDrawer = useCallback(() => {
    setVersionDrawerOpen(false);
  }, []);

  const handleApplyCode = async () => {
    setIsApplyingCode(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      const s = getStrategy(format);
      const result = s.validate(generatedCode);
      if (result.valid) {
        dispatchGenResult({ type: 'SET_RENDER_DATA', payload: result.data });
        dispatchGenResult({ type: 'SET_JSON_ERROR', payload: null });
      } else {
        dispatchGenResult({ type: 'SET_JSON_ERROR', payload: result.error });
      }
    } finally {
      setIsApplyingCode(false);
    }
  };

  const handleExport = useCallback(() => {
    const blob = strategy.createExportBlob(generatedCode);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram.${strategy.fileExtension}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [strategy, generatedCode]);

  /** 导出为 PNG/SVG/代码文件 */
  const handleExportAs = useCallback(async (exportFormat: ExportFormat) => {
    // 代码文件导出使用原有逻辑
    if (exportFormat === 'code') {
      handleExport();
      return;
    }

    // PNG/SVG 导出需要画布支持
    if (!canvasExportRef.current) {
      showNotification(t('notification.exportFailed'), t('notification.exportNotSupported'), 'error');
      return;
    }

    try {
      const blob = await canvasExportRef.current.exportAs(exportFormat);
      const ext = getFileExtension(exportFormat, format);
      const mime = getMimeType(exportFormat);
      const finalBlob = exportFormat === 'png' ? blob : new Blob([blob], { type: mime });
      downloadBlob(finalBlob, `diagram.${ext}`);
    } catch (e) {
      showNotification(t('notification.exportFailed'), (e as Error).message, 'error');
    }
  }, [format, handleExport, showNotification, t]);

  return (
    <>
      <div className="h-full flex flex-col relative overflow-hidden bg-[var(--bg)] noise-overlay">
        {/* Decorative Blur Orbs */}
        <div className="blur-orb blur-orb-indigo" style={{ width: 320, height: 320, top: '-60px', left: '-80px' }} />
        <div className="blur-orb blur-orb-violet" style={{ width: 260, height: 260, bottom: '-40px', right: '10%' }} />
        <div className="blur-orb blur-orb-cyan" style={{ width: 200, height: 200, top: '40%', right: '-40px' }} />

        {/* 全局顶栏 */}
        <EditorTopBar
          onGoHome={() => router.push('/')}
          conversationId={conversation.conversationId}
          onLoadConversation={conversation.loadConversation}
          onNewConversation={conversation.newConversation}
          onOpenConfig={() => setIsConfigManagerOpen(true)}
          isConfigOpen={isConfigManagerOpen}
          onVersionHistory={() => setVersionDrawerOpen(prev => !prev)}
          isVersionDrawerOpen={versionDrawerOpen}
        />

        {/* 主内容区域：侧边栏 + 画布 */}
        <div className="flex-1 flex min-h-0">
          {/* AI Copilot Panel (Left) */}
          <AICopilotPanel
            conversationId={conversation.conversationId}
            messages={conversation.messages}
            isStreaming={generation.isStreaming}
            onSendMessage={generation.sendMessage}
            onCancel={generation.cancelGeneration}
            isGenerating={generation.isGenerating}
            currentInput={currentInput}
            currentChartType={currentChartType}
            currentFormat={format}
            onFormatChange={(f) => { setFormat(f); dispatchGenResult({ type: 'CLEAR' }); }}
            onExport={handleExport}
            onRegenerate={() => generation.regenerate(conversation.messages, currentChartType)}
            onShowDiagram={handleShowDiagram}
            apiError={generation.apiError}
            onClearError={() => generation.setApiError(null)}
            panelWidth={panelWidth}
            onPanelWidthChange={handlePanelWidthChange}
            collapsed={isPanelCollapsed}
            onCollapsedChange={setIsPanelCollapsed}
          />

          {/* 分割线折叠按钮 */}
          <div className="relative flex-shrink-0 w-3 flex items-center justify-center group cursor-pointer" onClick={() => setIsPanelCollapsed(prev => !prev)}>
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[var(--border)]" />
            <Tooltip key={String(isPanelCollapsed)} content={isPanelCollapsed ? '展开' : '收起'} side={isPanelCollapsed ? 'right' : 'bottom'}>
              <div className="relative z-30 w-5 h-10 flex items-center justify-center rounded-md bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] opacity-0 group-hover:opacity-100 transition-all duration-200">
                {isPanelCollapsed ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronLeft size={12} />
                )}
              </div>
            </Tooltip>
          </div>

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col relative">
            {/* Floating AI Actions */}
            <FloatingAIActions
              onAction={aiActions.handleAIAction}
              loadingAction={aiActions.aiActionLoading}
              disabled={generation.isGenerating || !generatedCode}
            />

            {/* Canvas */}
            <div className="flex-1 relative">
              <DiagramCanvas format={format} data={renderData} isStreaming={generation.isStreaming} streamRendererRef={streamRendererRef} exportRef={canvasExportRef} />
            </div>

            {/* Bottom Context Panel */}
            <BottomContextPanel
              generatedCode={generatedCode}
              explanation={aiActions.aiExplanation}
              format={format}
              activeTab={bottomPanelTab}
              onTabChange={setBottomPanelTab}
              onExportAs={handleExportAs}
            >
              <CodeEditor
                code={generatedCode}
                onChange={(v) => dispatchGenResult({ type: 'SET_CODE', payload: v ?? '' })}
                onApply={handleApplyCode}
                onClear={() => dispatchGenResult({ type: 'SET_CODE', payload: '' })}
                jsonError={jsonError}
                onClearJsonError={() => dispatchGenResult({ type: 'SET_JSON_ERROR', payload: null })}
                isGenerating={generation.isGenerating}
                isApplyingCode={isApplyingCode}
                language={strategy.codeLanguage}
              />
            </BottomContextPanel>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfigSelector isOpen={isConfigManagerOpen} onClose={() => setIsConfigManagerOpen(false)} onConfigSelect={handleConfigSelect} />

      <VersionHistoryDrawer
        open={versionDrawerOpen}
        onClose={handleCloseVersionDrawer}
        versions={versions}
        currentVersionId={currentVersionId}
        onSelectVersion={handleSelectVersion}
      />
    </>
  );
}

export default function EditorPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-[var(--bg)] noise-overlay">
        <div className="blur-orb blur-orb-indigo" style={{ width: 240, height: 240, top: '30%', left: '30%' }} />
        <div className="blur-orb blur-orb-violet" style={{ width: 200, height: 200, bottom: '20%', right: '25%' }} />
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 w-10 h-10 rounded-[16px] bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] blur-xl opacity-30 animate-pulse-glow" />
            <div className="animate-pulse rounded-[16px] relative">
              <AppIcon size={40} />
            </div>
          </div>
          <p className="text-sm text-[var(--muted)] font-medium">{t('editor.loading')}</p>
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
