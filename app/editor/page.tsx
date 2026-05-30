'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { AppIcon } from '@/components/layout/TopBar';
import AICopilotPanel from '@/components/ai/AICopilotPanel';
import FloatingAIActions from '@/components/ai/FloatingAIActions';
import BottomContextPanel from '@/components/layout/BottomContextPanel';
import CodeEditor from '@/components/CodeEditor';
import ConfigManager from '@/components/dialogs/ConfigManager';
import Notification from '@/components/Notification';
import DiagramCanvas from '@/components/canvases/DiagramCanvas';
import type { StreamRendererRef } from '@/components/canvases/ExcalidrawCanvas';
import * as api from '@/lib/api-client';
import { isConfigValid } from '@/lib/config-validator';
import { getStrategy } from '@/lib/strategies/registry';
import { stripCodeFences } from '@/lib/diagram/json-repair';
import { consumeInitData } from '@/lib/init-data';
import { runMigrationIfNeeded } from '@/lib/migration';
import { useLocale } from '@/locales';
import type { LLMConfig, NotificationState, AIActionId, ConversationMessage } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

import { generateId, parseStoredImages } from '@/lib/utils';
import { consumeSSEStream, parseAPIError } from '@/lib/sse-consumer';

function EditorContent() {
  const { t } = useLocale();
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [isConfigManagerOpen, setIsConfigManagerOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [format, setFormat] = useState<DiagramFormat>('excalidraw');
  const [renderData, setRenderData] = useState<unknown>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [isOptimizingCode, setIsOptimizingCode] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [currentChartType, setCurrentChartType] = useState('auto');
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Conversation state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  // Panel width (not persisted — resets on refresh/navigate)
  const [panelWidth, setPanelWidth] = useState(360);

  const handlePanelWidthChange = useCallback((w: number) => {
    setPanelWidth(Math.min(Math.max(w, 280), 600));
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const data = await api.fetchConfigs();
      if (data.activeConfigId) {
        const active = data.configs.find(c => c.id === data.activeConfigId);
        if (active) setConfig(active);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }, []);

  useEffect(() => {
    runMigrationIfNeeded().then(() => loadConfig());
  }, [loadConfig]);

  // Consume init data from sessionStorage on mount (set by homepage before navigation)
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

    // 存储 source 参数，用于自动发送时确定 sourceType
    pendingInitRef.current = init;
    pendingSourceRef.current = source;
  }, []);

  const pendingInitRef = useRef<import('@/lib/init-data').InitData | null>(null);
  const pendingSourceRef = useRef<string>('text');
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamRendererRef = useRef<StreamRendererRef | null>(null);
  const formatRef = useRef(format);
  useEffect(() => { formatRef.current = format; }, [format]);
  const isFirstFormatRef = useRef(true);
  const isStreamingRef = useRef(false);
  useEffect(() => {
    if (isFirstFormatRef.current) { isFirstFormatRef.current = false; return; }
    setGeneratedCode('');
    setJsonError(null);
    setRenderData(null);
    streamRendererRef.current?.reset();
  }, [format]);
  const strategy = getStrategy(format);

  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
    setIsStreaming(false);
  }, []);

  // Abort in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSendMessage = useCallback(async (userMessage: string | { text?: string; images?: unknown[] }, chartType: string = 'auto', sourceType: string = 'text') => {
    if (isGenerating) return;

    if (!isConfigValid(config)) {
      setNotification({ isOpen: true, title: t('editor.configReminder'), message: t('editor.pleaseConfigLLM'), type: 'warning' });
      setIsConfigManagerOpen(true);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userContent = typeof userMessage === 'string' ? userMessage : (userMessage.text || '');

    setCurrentChartType(chartType);
    setIsGenerating(true);
    setIsStreaming(true);
    setApiError(null);
    setJsonError(null);

    // Optimistic: add user + assistant messages to local state
    const optimisticUserMsg: ConversationMessage = {
      id: generateId(),
      conversationId: conversationId || '',
      role: 'user',
      content: userContent,
      sourceType: sourceType as 'text' | 'file' | 'image',
      createdAt: Date.now(),
      ...(sourceType === 'image' && typeof userMessage === 'object' && userMessage.images?.length ? {
        imageData: (userMessage.images[0] as { data?: string })?.data,
        imageMimeType: (userMessage.images[0] as { mimeType?: string })?.mimeType,
      } : {}),
    };
    const optimisticAssistantMsg: ConversationMessage = {
      id: generateId(),
      conversationId: conversationId || '',
      role: 'assistant',
      content: '',
      sourceType: 'text',
      createdAt: Date.now(),
    };
    setMessages(prev => [...prev, optimisticUserMsg, optimisticAssistantMsg]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: config!.id, userInput: userMessage, chartType, format, conversationId, sourceType }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = t('editor.generateFailed');
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch {
          switch (response.status) {
            case 400: errorMessage = t('editor.requestError'); break;
            case 401: case 403: errorMessage = t('editor.apiKeyError'); break;
            case 429: errorMessage = t('editor.rateLimit'); break;
            case 500: case 502: case 503: errorMessage = t('editor.serverError'); break;
            default: errorMessage = `${t('editor.requestFailed')} (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error('Response body is null');

      let activeConvId = conversationId;
      const { accumulatedCode } = await consumeSSEStream(
        response.body.getReader(),
        controller.signal,
        {
          onMeta: (convId) => {
            activeConvId = convId;
            setConversationId(convId);
            setMessages(prev => prev.map(m =>
              (m.id === optimisticUserMsg.id || m.id === optimisticAssistantMsg.id) ? { ...m, conversationId: convId } : m
            ));
          },
          onContent: (stripped) => {
            setGeneratedCode(stripped);
            streamRendererRef.current?.feed(stripped);
            setMessages(prev => prev.map(m =>
              m.id === optimisticAssistantMsg.id ? { ...m, content: stripped } : m
            ));
          },
        },
      );

      // Full postProcess + optimize + validate after stream completes
      const currentStrategy = getStrategy(formatRef.current);
      const processedCode = currentStrategy.postProcess(accumulatedCode);
      const optimizedCode = currentStrategy.optimize(processedCode);
      setGeneratedCode(optimizedCode);
      tryParseAndApply(optimizedCode, currentStrategy);
      streamRendererRef.current?.reset();

      // Update streaming assistant message with final post-processed code
      setMessages(prev => prev.map(m =>
        m.id === optimisticAssistantMsg.id ? { ...m, content: optimizedCode, conversationId: activeConvId || m.conversationId } : m
      ));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[stream] error:', error);
      setApiError(error instanceof TypeError || (error as Error).message === 'Failed to fetch'
        ? t('editor.networkError')
        : (error as Error).message);
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
      setIsStreaming(false);
    }
  }, [config, format, conversationId, isGenerating]);

  // Send pending init data once config is loaded
  useEffect(() => {
    if (!config || !pendingInitRef.current) return;

    const init = pendingInitRef.current;
    pendingInitRef.current = null;

    const data = init.data;
    // 使用 URL 参数 source 确定 sourceType（首页传文件时 orchestrator 返回 type='text'，但 source='file'）
    const resolvedSource = pendingSourceRef.current || (init.type === 'image' ? 'image' : init.type === 'file' ? 'file' : 'text');

    if (init.type === 'text' && typeof data === 'string') {
      handleSendMessage(data, 'auto', resolvedSource);
    } else if (init.type === 'file' && data) {
      handleSendMessage(data as string, 'auto', resolvedSource);
    } else if (init.type === 'image' && data) {
      handleSendMessage(data as { text?: string; images?: unknown[] }, 'auto', 'image');
    }
    setCurrentInput('');
  }, [config, handleSendMessage]);

  // Mermaid 和 Draw.io 不在流式期间渲染，等流式完成后再渲染（由 tryParseAndApply 处理）
  // 侧边栏 AI 输出仍然流式显示

  const tryParseAndApply = (code: string, strat?: ReturnType<typeof getStrategy>) => {
    const s = strat || strategy;
    const result = s.validate(code);
    if (result.valid) {
      setRenderData(result.data);
      setJsonError(null);
    } else {
      setJsonError(result.error);
    }
  };

  const handleApplyCode = async () => {
    setIsApplyingCode(true);
    try { await new Promise(r => setTimeout(r, 300)); tryParseAndApply(generatedCode); }
    finally { setIsApplyingCode(false); }
  };

  const handleOptimizeCode = async () => {
    setIsOptimizingCode(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      const optimizedCode = strategy.optimize(generatedCode);
      setGeneratedCode(optimizedCode);
      tryParseAndApply(optimizedCode);
    } finally { setIsOptimizingCode(false); }
  };

  const handleConfigSelect = (selectedConfig: LLMConfig | null) => { if (selectedConfig) setConfig(selectedConfig); };

  const handleLoadConversation = useCallback(async (id: string) => {
    try {
      const conv = await api.getConversation(id);
      setConversationId(conv.id);
      setMessages(conv.messages);
      setCurrentChartType(conv.chartType);
      if (conv.format && ['excalidraw', 'mermaid', 'drawio'].includes(conv.format)) {
        setFormat(conv.format);
      }
      const strat = getStrategy(conv.format);
      const code = conv.currentCode ? strat.optimize(conv.currentCode) : '';
      setGeneratedCode(code);
      if (code) {
        const result = strat.validate(code);
        if (result.valid) {
          setRenderData(result.data);
          setJsonError(null);
        } else {
          setJsonError(result.error);
        }
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setApiError('Failed to load conversation');
    }
  }, []);

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setGeneratedCode('');
    setRenderData(null);
    setCurrentInput('');
    setJsonError(null);
    setApiError(null);
    setFormat('excalidraw');
    setCurrentChartType('auto');
    streamRendererRef.current?.reset();
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    if (id === conversationId) {
      handleNewConversation();
    }
  }, [conversationId, handleNewConversation]);

  const handleRegenerate = useCallback(async () => {
    if (isGenerating || messages.length === 0) return;
    if (!isConfigValid(config)) {
      setNotification({ isOpen: true, title: t('editor.configReminder'), message: t('editor.pleaseConfigLLM'), type: 'warning' });
      setIsConfigManagerOpen(true);
      return;
    }

    // 找到最后一条 user 消息和 assistant 消息
    const lastUserIdx = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return;
    const lastUserMsg = messages[messages.length - 1 - lastUserIdx];

    // 从 user 消息中还原 images
    const images = parseStoredImages(lastUserMsg.imageData, lastUserMsg.imageMimeType);

    const userInput = images.length > 0
      ? { text: lastUserMsg.content, images }
      : lastUserMsg.content;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setIsStreaming(true);
    setApiError(null);
    setJsonError(null);
    setGeneratedCode('');
    setRenderData(null);

    // 删除旧的 assistant 消息，添加新的占位
    setMessages(prev => {
      const lastAssistantIdx = [...prev].reverse().findIndex(m => m.role === 'assistant');
      if (lastAssistantIdx === -1) return prev;
      const idx = prev.length - 1 - lastAssistantIdx;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });

    // 仅添加 assistant 占位消息（不添加新的 user 消息）
    const optimisticAssistantMsg: ConversationMessage = {
      id: generateId(),
      conversationId: conversationId || '',
      role: 'assistant',
      content: '',
      sourceType: 'text',
      createdAt: Date.now(),
    };
    setMessages(prev => [...prev, optimisticAssistantMsg]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: config!.id,
          userInput,
          chartType: currentChartType,
          format,
          conversationId,
          sourceType: lastUserMsg.sourceType || 'text',
          regenerate: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = t('editor.generateFailed');
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch {
          switch (response.status) {
            case 400: errorMessage = t('editor.requestError'); break;
            case 401: case 403: errorMessage = t('editor.apiKeyError'); break;
            case 429: errorMessage = t('editor.rateLimit'); break;
            case 500: case 502: case 503: errorMessage = t('editor.serverError'); break;
            default: errorMessage = `${t('editor.requestFailed')} (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error('Response body is null');

      const { accumulatedCode } = await consumeSSEStream(
        response.body.getReader(),
        controller.signal,
        {
          onContent: (stripped) => {
            setGeneratedCode(stripped);
            streamRendererRef.current?.feed(stripped);
            setMessages(prev => prev.map(m =>
              m.id === optimisticAssistantMsg.id ? { ...m, content: stripped } : m
            ));
          },
        },
      );

      // 与 handleSendMessage 一致：postProcess + optimize
      const currentStrategy = getStrategy(formatRef.current);
      const processedCode = currentStrategy.postProcess(accumulatedCode);
      const optimizedCode = currentStrategy.optimize(processedCode);
      setGeneratedCode(optimizedCode);
      setMessages(prev => prev.map(m =>
        m.id === optimisticAssistantMsg.id ? { ...m, content: optimizedCode } : m
      ));
      tryParseAndApply(optimizedCode, currentStrategy);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setApiError((error as Error).message || t('editor.generateFailed'));
      }
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [isGenerating, messages, config, currentChartType, format, conversationId, t]);

  const handleAIAction = (actionId: AIActionId) => {
    switch (actionId) {
      case 'optimize': handleOptimizeCode(); break;
      case 'layout': setNotification({ isOpen: true, title: t('editor.layoutOptimize'), message: t('editor.layoutOptimizing'), type: 'info' }); break;
      case 'beautify': setNotification({ isOpen: true, title: t('editor.beautifyChart'), message: t('editor.beautifying'), type: 'info' }); break;
      case 'explain': break;
      case 'generate': setNotification({ isOpen: true, title: t('editor.generateNode'), message: t('editor.describeNode'), type: 'info' }); break;
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
          conversationId={conversationId}
          messages={messages}
          isStreaming={isStreaming}
          onLoadConversation={handleLoadConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onSendMessage={handleSendMessage}
          onCancel={handleCancelGeneration}
          isGenerating={isGenerating}
          currentInput={currentInput}
          currentChartType={currentChartType}
          currentFormat={format}
          onFormatChange={(f) => { setFormat(f); setRenderData(null); setGeneratedCode(''); }}
          onOpenConfig={() => setIsConfigManagerOpen(true)}
          onExport={handleExport}
          onRegenerate={handleRegenerate}
          apiError={apiError}
          onClearError={() => setApiError(null)}
          panelWidth={panelWidth}
          onPanelWidthChange={handlePanelWidthChange}
        />

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col relative">
          {/* Floating AI Actions */}
          <FloatingAIActions onAction={handleAIAction} />

          {/* Canvas */}
          <div className="flex-1 relative">
            <DiagramCanvas format={format} data={renderData} isStreaming={isStreaming} streamRendererRef={streamRendererRef} />
          </div>

          {/* Bottom Context Panel */}
          <BottomContextPanel generatedCode={generatedCode}>
            <CodeEditor
              code={generatedCode}
              onChange={(v) => setGeneratedCode(v ?? '')}
              onApply={handleApplyCode}
              onOptimize={handleOptimizeCode}
              onClear={() => setGeneratedCode('')}
              jsonError={jsonError}
              onClearJsonError={() => setJsonError(null)}
              isGenerating={isGenerating}
              isApplyingCode={isApplyingCode}
              isOptimizingCode={isOptimizingCode}
              language={strategy.codeLanguage}
            />
          </BottomContextPanel>
        </div>
      </div>

      {/* Modals */}
      <ConfigManager isOpen={isConfigManagerOpen} onClose={() => setIsConfigManagerOpen(false)} onConfigSelect={handleConfigSelect} />
      <Notification isOpen={notification.isOpen} onClose={() => setNotification({ ...notification, isOpen: false })} title={notification.title} message={notification.message} type={notification.type} />
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
