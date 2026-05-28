'use client';

import { Editor } from '@monaco-editor/react';
import { Trash2, Wand2, ArrowRight, Loader2, X } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange?: (value: string | undefined) => void;
  onApply: () => void;
  onOptimize: () => void;
  onClear: () => void;
  jsonError: string | null;
  onClearJsonError: () => void;
  isGenerating: boolean;
  isApplyingCode: boolean;
  isOptimizingCode: boolean;
  language?: string;
}

export default function CodeEditor({ code, onChange, onApply, onOptimize, onClear, jsonError, onClearJsonError, isGenerating, isApplyingCode, isOptimizingCode, language = 'javascript' }: CodeEditorProps) {
  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0">
        <h3 className="text-xs font-medium text-[var(--muted)]">生成代码</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onClear}
            disabled={isGenerating || isApplyingCode || isOptimizingCode}
            title="清除"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onOptimize}
            disabled={isGenerating || isApplyingCode || isOptimizingCode || !code?.trim()}
            title="优化布局"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isOptimizingCode ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          </button>
          <button
            onClick={onApply}
            disabled={isGenerating || isApplyingCode || isOptimizingCode || !code?.trim()}
            title="应用到画布"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isApplyingCode ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          </button>
        </div>
      </div>

      {/* JSON Error Banner */}
      {jsonError && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-red-50/80 border border-red-200/50 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono text-red-700 break-words">{jsonError}</p>
          </div>
          <button onClick={onClearJsonError} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage={language}
          value={code}
          onChange={onChange}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>
    </div>
  );
}
