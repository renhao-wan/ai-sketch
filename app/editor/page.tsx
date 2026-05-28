'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AppIcon } from '@/components/TopBar';
import AICopilotPanel from '@/components/AICopilotPanel';
import FloatingAIActions from '@/components/FloatingAIActions';
import BottomContextPanel from '@/components/BottomContextPanel';
import CodeEditor from '@/components/CodeEditor';
import ConfigManager from '@/components/ConfigManager';
import HistoryModal from '@/components/HistoryModal';
import Notification from '@/components/Notification';
import { getConfig, isConfigValid } from '@/lib/config';
import { optimizeExcalidrawCode } from '@/lib/optimizeArrows';
import { historyManager } from '@/lib/history-manager';
import { repairJsonClosure } from '@/lib/json-repair';
import type { LLMConfig, HistoryItem, NotificationState, AIActionId, ExcalidrawElement } from '@/types';

const ExcalidrawCanvas = dynamic(() => import('@/components/ExcalidrawCanvas'), {
  ssr: false,
});

function EditorContent() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [isConfigManagerOpen, setIsConfigManagerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [elements, setElements] = useState<ExcalidrawElement[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [isOptimizingCode, setIsOptimizingCode] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [currentChartType, setCurrentChartType] = useState('auto');
  const [bottomPanelContent, setBottomPanelContent] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    const savedConfig = getConfig();
    if (savedConfig) setConfig(savedConfig);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'smart-excalidraw-active-config' || e.key === 'smart-excalidraw-configs') {
        setConfig(getConfig());
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const prompt = searchParams.get('prompt');
    const format = searchParams.get('format');
    const source = searchParams.get('source');

    if (source === 'file' || source === 'image') {
      try {
        const raw = sessionStorage.getItem('ai-sketch-init-data');
        if (raw) {
          const init = JSON.parse(raw);
          sessionStorage.removeItem('ai-sketch-init-data');
          if (init.type === 'file' && init.data) {
            setCurrentInput(init.data);
            setCurrentChartType(init.format || 'auto');
            setTimeout(() => handleSendMessage(init.data, init.format || 'auto', 'file'), 300);
          } else if (init.type === 'image' && init.data) {
            setCurrentChartType(init.format || 'auto');
            setTimeout(() => handleSendMessage(init.data, init.format || 'auto', 'image'), 300);
          }
        }
      } catch (e) {
        console.error('Failed to read init data:', e);
      }
    } else if (prompt) {
      setCurrentInput(prompt);
      if (format) setCurrentChartType(format);
      setTimeout(() => {
        handleSendMessage(prompt, format || 'auto', 'text');
      }, 300);
    }
  }, [searchParams]);

  const postProcessExcalidrawCode = (code: string): string => {
    if (!code || typeof code !== 'string') return code;
    let processed = code.trim();
    processed = processed.replace(/^```(?:json|javascript|js)?\s*\n?/i, '');
    processed = processed.replace(/\n?```\s*$/, '');
    processed = processed.trim();
    processed = repairJsonClosure(processed);
    try {
      JSON.parse(processed);
      return processed;
    } catch (e) {
      processed = fixUnescapedQuotes(processed);
      processed = repairJsonClosure(processed);
      return processed;
    }
  };

  const fixUnescapedQuotes = (jsonString: string): string => {
    let result = '';
    let inString = false;
    let escapeNext = false;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];
      if (escapeNext) { result += char; escapeNext = false; continue; }
      if (char === '\\') { result += char; escapeNext = true; continue; }
      if (char === '"') {
        if (!inString) { inString = true; result += char; }
        else {
          const nextNonWhitespace = jsonString.slice(i + 1).match(/^\s*(.)/);
          const nextChar = nextNonWhitespace ? nextNonWhitespace[1] : '';
          if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '') {
            inString = false; result += char;
          } else { result += '\\"'; }
        }
      } else { result += char; }
    }
    return result;
  };

  const handleSendMessage = useCallback(async (userMessage: string | { text?: string; image?: unknown }, chartType: string = 'auto', sourceType: string = 'text') => {
    if (!isConfigValid(config)) {
      setNotification({ isOpen: true, title: '配置提醒', message: '请先配置您的 LLM 提供商', type: 'warning' });
      setIsConfigManagerOpen(true);
      return;
    }

    setCurrentInput(typeof userMessage === 'string' ? userMessage : (userMessage.text || ''));
    setCurrentChartType(chartType);
    setIsGenerating(true);
    setApiError(null);
    setJsonError(null);

    try {
      const headers = { 'Content-Type': 'application/json' };

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ config, userInput: userMessage, chartType }),
      });

      if (!response.ok) {
        let errorMessage = '生成代码失败';
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
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
              if (data.content) {
                accumulatedCode += data.content;
                const processedCode = postProcessExcalidrawCode(accumulatedCode);
                setGeneratedCode(processedCode);
              } else if (data.error) { throw new Error(data.error); }
            } catch (e) {
              if ((e as Error).message && !(e as Error).message.includes('Unexpected')) setApiError('数据流解析错误：' + (e as Error).message);
            }
          }
        }
      }

      const processedCode = postProcessExcalidrawCode(accumulatedCode);
      tryParseAndApply(processedCode);
      const optimizedCode = optimizeExcalidrawCode(processedCode);
      setGeneratedCode(optimizedCode);
      tryParseAndApply(optimizedCode);

      if (sourceType === 'text' && userMessage && optimizedCode) {
        const userInputText = typeof userMessage === 'object' ? ((userMessage as { text?: string }).text || '') : userMessage;
        historyManager.addHistory({
          chartType, userInput: userInputText, generatedCode: optimizedCode,
          config: { name: config?.name || config?.type, model: config?.model },
        });
      }
    } catch (error) {
      if ((error as Error).message === 'Failed to fetch' || (error as Error).name === 'TypeError') setApiError('网络连接失败，请检查网络连接');
      else setApiError((error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, [config]);

  const tryParseAndApply = (code: string) => {
    try {
      setJsonError(null);
      const cleanedCode = code.trim();
      const arrayMatch = cleanedCode.match(/\[[\s\S]*\]/);
      if (!arrayMatch) { setJsonError('代码中未找到有效的 JSON 数组'); return; }
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) { setElements(parsed); setJsonError(null); }
    } catch (error) {
      if (error instanceof SyntaxError) setJsonError('JSON 语法错误：' + error.message);
      else setJsonError('解析失败：' + (error as Error).message);
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
      const optimizedCode = optimizeExcalidrawCode(generatedCode);
      setGeneratedCode(optimizedCode);
      tryParseAndApply(optimizedCode);
    } finally { setIsOptimizingCode(false); }
  };

  const handleConfigSelect = (selectedConfig: LLMConfig | null) => { if (selectedConfig) setConfig(selectedConfig); };

  const handleApplyHistory = (history: HistoryItem) => {
    const userInputText = typeof history.userInput === 'object' ? ((history.userInput as { text?: string }).text || '图片上传生成') : history.userInput;
    setCurrentInput(userInputText);
    setCurrentChartType(history.chartType);
    setGeneratedCode(history.generatedCode);
    tryParseAndApply(history.generatedCode);
  };

  const handleAIAction = (actionId: AIActionId) => {
    switch (actionId) {
      case 'optimize': handleOptimizeCode(); break;
      case 'layout': setNotification({ isOpen: true, title: '自动布局', message: '布局优化中...', type: 'info' }); break;
      case 'beautify': setNotification({ isOpen: true, title: '美化图表', message: '正在美化...', type: 'info' }); break;
      case 'explain': setBottomPanelContent('ai'); break;
      case 'generate': setNotification({ isOpen: true, title: '生成节点', message: '请描述要添加的节点', type: 'info' }); break;
    }
  };

  const handleExport = () => {
    const blob = new Blob([generatedCode], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'diagram.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="h-full flex relative overflow-hidden">
        {/* AI Copilot Panel (Left) */}
        <AICopilotPanel
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          currentInput={currentInput}
          currentChartType={currentChartType}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenConfig={() => setIsConfigManagerOpen(true)}
          onExport={handleExport}
          apiError={apiError}
          onClearError={() => setApiError(null)}
        />

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col relative">
          {/* Floating AI Actions */}
          <FloatingAIActions onAction={handleAIAction} />

          {/* Canvas */}
          <div className="flex-1 relative">
            <ExcalidrawCanvas elements={elements} />
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
      <div className="h-full flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-pulse rounded-[16px]">
            <AppIcon size={40} />
          </div>
          <p className="text-sm text-[var(--muted)]">加载编辑器...</p>
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
