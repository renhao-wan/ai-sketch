'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/layout/TopBar';
import WindowControls from '@/components/layout/WindowControls';
import AICopilotPanel from '@/components/ai/AICopilotPanel';
import FloatingAIActions from '@/components/ai/FloatingAIActions';
import CodeEditor from '@/components/editor/CodeEditor';
import Notification from '@/components/ui/Notification';
import DiagramCanvas from '@/components/canvases/DiagramCanvas';
import type { StreamRendererRef } from '@/components/canvases/ExcalidrawCanvas';
import * as api from '@/lib/api/client';
import { isConfigValid } from '@/lib/api/config-validator';
import { getStrategy } from '@/lib/strategies/registry';
import { consumeInitData } from '@/lib/utils/init-data';
import { useLocale } from '@/lib/locales';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useNotification } from '@/hooks/useNotification';
import { useConversation } from '@/hooks/useConversation';
import { useGeneration } from '@/hooks/useGeneration';
import { useAIActions } from '@/hooks/useAIActions';
import type { LLMConfig } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

// 动态导入重型组件（按需加载）
const ConfigSelector = dynamic(() => import('@/components/dialogs/ConfigSelector'), { ssr: false });
const BottomContextPanel = dynamic(() => import('@/components/layout/BottomContextPanel'), { ssr: false });

function EditorContent() {
  const router = useRouter();
  const { t } = useLocale();
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isConfigManagerOpen, setIsConfigManagerOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [format, setFormat] = useState<DiagramFormat>('excalidraw');

  const [renderData, setRenderData] = useState<unknown>(null);
  const [isApplyingCode, setIsApplyingCode] = useState(false);

  const [jsonError, setJsonError] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [currentChartType, setCurrentChartType] = useState('auto');
  const { notification, showNotification, closeNotification } = useNotification();
  const [bottomPanelTab, setBottomPanelTab] = useState('code');

  // Panel width (not persisted — resets on refresh/navigate)
  const [panelWidth, setPanelWidth] = useState(360);
  const [isElectron, setIsElectron] = useState(false);

  // Refs
  const pendingInitRef = useRef<import('@/lib/utils/init-data').InitData | null>(null);
  const pendingSourceRef = useRef<string>('text');
  const streamRendererRef = useRef<StreamRendererRef | null>(null);
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
        if (active) setConfig(active);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setConfigLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 会话管理 Hook
  const conversation = useConversation({
    onFormatChange: (f) => setFormat(f),
    onChartTypeChange: setCurrentChartType,
    onCodeClear: () => {
      setGeneratedCode('');
      setRenderData(null);
      setJsonError(null);
    },
    onError: (msg) => generation.setApiError(msg),
  });

  // 代码生成 Hook
  const generation = useGeneration({
    config,
    format,
    conversationId: conversation.conversationId,
    streamRendererRef,
    onCodeUpdate: setGeneratedCode,
    onRenderDataUpdate: setRenderData,
    onJsonErrorUpdate: setJsonError,
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
    onCodeUpdate: setGeneratedCode,
    onExplanationUpdate: (exp) => {}, // 已在 Hook 内部处理
    onBottomPanelTabChange: setBottomPanelTab,
    onRenderDataUpdate: setRenderData,
    onJsonErrorUpdate: setJsonError,
    onNotification: showNotification,
  });

  // 格式切换时清空代码
  useEffect(() => {
    if (isFirstFormatRef.current) { isFirstFormatRef.current = false; return; }
    if (skipFormatClearRef.current) { skipFormatClearRef.current = false; return; }
    setGeneratedCode('');
    setJsonError(null);
    setRenderData(null);
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
    if (selectedConfig) setConfig(selectedConfig);
  };

  // 注册快捷键
  useShortcuts({
    onGoHome: () => router.push('/'),
    onNewConversation: conversation.newConversation,
    onOpenSettings: (tab) => router.push(tab ? `/settings?tab=${tab}` : '/settings'),
  });

  const detectCodeFormat = (code: string): DiagramFormat => {
    const trimmed = code.trim();
    if (trimmed.startsWith('<')) return 'drawio';
    if (trimmed.startsWith('[')) return 'excalidraw';
    if (trimmed.startsWith('{') && trimmed.includes('"elements"')) return 'excalidraw';
    return 'mermaid';
  };

  const handleShowDiagram = useCallback((content: string) => {
    const detectedFormat = detectCodeFormat(content);
    if (detectedFormat !== format) {
      skipFormatClearRef.current = true;
      setFormat(detectedFormat);
    }
    const strat = getStrategy(detectedFormat);
    const processed = strat.postProcess(content);
    const optimized = strat.optimize(processed);
    setGeneratedCode(optimized);
    const result = strat.validate(optimized);
    if (result.valid) {
      setRenderData(result.data);
      setJsonError(null);
    } else {
      setJsonError(result.error);
    }
  }, [format]);

  const handleApplyCode = async () => {
    setIsApplyingCode(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      const s = getStrategy(format);
      const result = s.validate(generatedCode);
      if (result.valid) {
        setRenderData(result.data);
        setJsonError(null);
      } else {
        setJsonError(result.error);
      }
    } finally {
      setIsApplyingCode(false);
    }
  };

  const handleExport = () => {
    const blob = strategy.createExportBlob(generatedCode);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram.${strategy.fileExtension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="h-full flex relative overflow-hidden bg-[var(--bg)] noise-overlay">
        {/* Decorative Blur Orbs */}
        <div className="blur-orb blur-orb-indigo" style={{ width: 320, height: 320, top: '-60px', left: '-80px' }} />
        <div className="blur-orb blur-orb-violet" style={{ width: 260, height: 260, bottom: '-40px', right: '10%' }} />
        <div className="blur-orb blur-orb-cyan" style={{ width: 200, height: 200, top: '40%', right: '-40px' }} />

        {/* AI Copilot Panel (Left) */}
        <AICopilotPanel
          conversationId={conversation.conversationId}
          messages={conversation.messages}
          isStreaming={generation.isStreaming}
          onLoadConversation={conversation.loadConversation}
          onNewConversation={conversation.newConversation}
          onSendMessage={generation.sendMessage}
          onCancel={generation.cancelGeneration}
          isGenerating={generation.isGenerating}
          currentInput={currentInput}
          currentChartType={currentChartType}
          currentFormat={format}
          onFormatChange={(f) => { setFormat(f); setRenderData(null); setGeneratedCode(''); }}
          onOpenConfig={() => setIsConfigManagerOpen(true)}
          onExport={handleExport}
          onRegenerate={() => generation.regenerate(conversation.messages, currentChartType)}
          onShowDiagram={handleShowDiagram}
          apiError={generation.apiError}
          onClearError={() => generation.setApiError(null)}
          panelWidth={panelWidth}
          onPanelWidthChange={handlePanelWidthChange}
          headerExtra={<WindowControls />}
        />

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
            <DiagramCanvas format={format} data={renderData} isStreaming={generation.isStreaming} streamRendererRef={streamRendererRef} />
          </div>

          {/* Bottom Context Panel */}
          <BottomContextPanel
            generatedCode={generatedCode}
            explanation={aiActions.aiExplanation}
            format={format}
            activeTab={bottomPanelTab}
            onTabChange={setBottomPanelTab}
          >
            <CodeEditor
              code={generatedCode}
              onChange={(v) => setGeneratedCode(v ?? '')}
              onApply={handleApplyCode}
              onClear={() => setGeneratedCode('')}
              jsonError={jsonError}
              onClearJsonError={() => setJsonError(null)}
              isGenerating={generation.isGenerating}
              isApplyingCode={isApplyingCode}
              language={strategy.codeLanguage}
            />
          </BottomContextPanel>
        </div>
      </div>

      {/* Modals */}
      <ConfigSelector isOpen={isConfigManagerOpen} onClose={() => setIsConfigManagerOpen(false)} onConfigSelect={handleConfigSelect} />
      <Notification isOpen={notification.isOpen} onClose={closeNotification} title={notification.title} message={notification.message} type={notification.type} />
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
