'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { AppIcon } from '@/components/TopBar';
import AICopilotPanel from '@/components/AICopilotPanel';
import FloatingAIActions from '@/components/FloatingAIActions';
import BottomContextPanel from '@/components/BottomContextPanel';
import CodeEditor from '@/components/CodeEditor';
import ConfigManager from '@/components/ConfigManager';
import HistoryModal from '@/components/HistoryModal';
import Notification from '@/components/Notification';
import DiagramCanvas from '@/components/DiagramCanvas';
import * as api from '@/lib/api-client';
import { isConfigValid } from '@/lib/config-validator';
import { getStrategy } from '@/lib/strategies/registry';
import { consumeInitData } from '@/lib/init-data';
import { runMigrationIfNeeded } from '@/lib/migration';
import type { LLMConfig, HistoryItem, NotificationState, AIActionId, ConversationMessage } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

import { generateId } from '@/lib/utils';

function EditorContent() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [isConfigManagerOpen, setIsConfigManagerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [format, setFormat] = useState<DiagramFormat>('excalidraw');
  const [renderData, setRenderData] = useState<unknown>([]);
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

    pendingInitRef.current = init;
  }, []);

  const pendingInitRef = useRef<import('@/lib/init-data').InitData | null>(null);
  const strategy = getStrategy(format);

  const handleSendMessage = useCallback(async (userMessage: string | { text?: string; images?: unknown[] }, chartType: string = 'auto', sourceType: string = 'text') => {
    if (!isConfigValid(config)) {
      setNotification({ isOpen: true, title: '配置提醒', message: '请先配置您的 LLM 提供商', type: 'warning' });
      setIsConfigManagerOpen(true);
      return;
    }

    const userContent = typeof userMessage === 'string' ? userMessage : (userMessage.text || '');

    setCurrentInput(userContent);
    setCurrentChartType(chartType);
    setIsGenerating(true);
    setIsStreaming(true);
    setApiError(null);
    setJsonError(null);

    // Optimistic: add user message to local state
    const optimisticUserMsg: ConversationMessage = {
      id: generateId(),
      conversationId: conversationId || '',
      role: 'user',
      content: userContent,
      sourceType: sourceType as 'text' | 'file' | 'image',
      createdAt: Date.now(),
    };
    setMessages(prev => [...prev, optimisticUserMsg]);

    const currentStrategy = getStrategy(format);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: config!.id, userInput: userMessage, chartType, format, conversationId }),
      });

      if (!response.ok) {
        let errorMessage = '生成代码失败';
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch {
          switch (response.status) {
            case 400: errorMessage = '请求参数错误，请检查输入内容'; break;
            case 401: case 403: errorMessage = 'API 密钥无效或权限不足，请检查配置'; break;
            case 429: errorMessage = '请求过于频繁，请稍后再试'; break;
            case 500: case 502: case 503: errorMessage = '服务器错误，请稍后重试'; break;
            default: errorMessage = `请求失败 (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedCode = '';
      let buffer = '';
      let activeConvId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'meta' && data.conversationId) {
                activeConvId = data.conversationId;
                setConversationId(data.conversationId);
                // Update the optimistic user message with the real conversationId
                setMessages(prev => prev.map(m =>
                  m.id === optimisticUserMsg.id ? { ...m, conversationId: data.conversationId } : m
                ));
              } else if (data.type === 'content' && data.content) {
                accumulatedCode += data.content;
                const processedCode = currentStrategy.postProcess(accumulatedCode);
                setGeneratedCode(processedCode);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              } else if (data.content) {
                // Backward compatibility: old format without type field
                accumulatedCode += data.content;
                const processedCode = currentStrategy.postProcess(accumulatedCode);
                setGeneratedCode(processedCode);
              }
            } catch (e) {
              if ((e as Error).message && !(e as Error).message.includes('Unexpected')) {
                setApiError('数据流解析错误：' + (e as Error).message);
              }
            }
          }
        }
      }

      const processedCode = currentStrategy.postProcess(accumulatedCode);
      tryParseAndApply(processedCode, currentStrategy);
      const optimizedCode = currentStrategy.optimize(processedCode);
      setGeneratedCode(optimizedCode);
      tryParseAndApply(optimizedCode, currentStrategy);

      // Add assistant message to local state
      const assistantMsg: ConversationMessage = {
        id: generateId(),
        conversationId: activeConvId || '',
        role: 'assistant',
        content: optimizedCode,
        sourceType: 'text',
        createdAt: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Save to history (backward compatibility)
      if (sourceType === 'text' && userContent && optimizedCode) {
        await api.addHistory({
          chartType, format, userInput: userContent, generatedCode: optimizedCode,
          config: { name: config?.name || config?.type, model: config?.model },
        });
      }
    } catch (error) {
      if ((error as Error).message === 'Failed to fetch' || (error as Error).name === 'TypeError') {
        setApiError('网络连接失败，请检查网络连接');
      } else {
        setApiError((error as Error).message);
      }
      // Remove optimistic user message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticUserMsg.id));
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  }, [config, format, conversationId]);

  // Send pending init data once config is loaded
  useEffect(() => {
    if (!config || !pendingInitRef.current) return;

    const init = pendingInitRef.current;
    pendingInitRef.current = null;

    const data = init.data;
    if (init.type === 'text' && typeof data === 'string') {
      handleSendMessage(data, 'auto', 'text');
    } else if (init.type === 'file' && data) {
      handleSendMessage(data as string, 'auto', 'file');
    } else if (init.type === 'image' && data) {
      handleSendMessage(data as { text?: string; images?: unknown[] }, 'auto', 'image');
    }
  }, [config, handleSendMessage]);

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
      setGeneratedCode(conv.currentCode);
      const strat = getStrategy(conv.format);
      if (conv.currentCode) {
        const result = strat.validate(conv.currentCode);
        if (result.valid) {
          setRenderData(result.data);
          setJsonError(null);
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
    setRenderData([]);
    setCurrentInput('');
    setJsonError(null);
    setApiError(null);
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    if (id === conversationId) {
      handleNewConversation();
    }
  }, [conversationId, handleNewConversation]);

  const handleApplyHistory = (history: HistoryItem) => {
    const userInputText = typeof history.userInput === 'object' ? ((history.userInput as { text?: string }).text || '图片上传生成') : history.userInput;
    setCurrentInput(userInputText);
    setCurrentChartType(history.chartType);
    if (history.format && ['excalidraw', 'mermaid', 'drawio'].includes(history.format)) {
      setFormat(history.format);
    }
    setGeneratedCode(history.generatedCode);
    const historyStrategy = history.format ? getStrategy(history.format) : strategy;
    const result = historyStrategy.validate(history.generatedCode);
    if (result.valid) {
      setRenderData(result.data);
      setJsonError(null);
    } else {
      setJsonError(result.error);
    }
  };

  const handleAIAction = (actionId: AIActionId) => {
    switch (actionId) {
      case 'optimize': handleOptimizeCode(); break;
      case 'layout': setNotification({ isOpen: true, title: '自动布局', message: '布局优化中...', type: 'info' }); break;
      case 'beautify': setNotification({ isOpen: true, title: '美化图表', message: '正在美化...', type: 'info' }); break;
      case 'explain': break;
      case 'generate': setNotification({ isOpen: true, title: '生成节点', message: '请描述要添加的节点', type: 'info' }); break;
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
          isGenerating={isGenerating}
          currentInput={currentInput}
          currentChartType={currentChartType}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenConfig={() => setIsConfigManagerOpen(true)}
          onExport={handleExport}
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
            <DiagramCanvas format={format} data={renderData} />
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
      <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} onApply={handleApplyHistory} />
      <Notification isOpen={notification.isOpen} onClose={() => setNotification({ ...notification, isOpen: false })} title={notification.title} message={notification.message} type={notification.type} />
    </>
  );
}

export default function EditorPage() {
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
          <p className="text-sm text-[var(--muted)] font-medium">加载编辑器...</p>
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
