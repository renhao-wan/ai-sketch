'use client';

import { useState, useEffect } from 'react';
import { Editor, loader } from '@monaco-editor/react';

// Lazy-init Monaco from local package (avoids CDN Tracking Prevention warnings)
let monacoLoadPromise: Promise<void> | null = null;
function ensureMonacoLoaded(): Promise<void> {
  if (!monacoLoadPromise) {
    monacoLoadPromise = import('monaco-editor').then((monaco) => {
      loader.config({ monaco: monaco.default || monaco });
    });
  }
  return monacoLoadPromise;
}
import { Trash2, ArrowRight, Loader2, X } from 'lucide-react';
import { useLocale } from '@/locales';

interface CodeEditorProps {
  code: string;
  onChange?: (value: string | undefined) => void;
  onApply: () => void;
  onClear: () => void;
  jsonError: string | null;
  onClearJsonError: () => void;
  isGenerating: boolean;
  isApplyingCode: boolean;
  language?: string;
}

export default function CodeEditor({ code, onChange, onApply, onClear, jsonError, onClearJsonError, isGenerating, isApplyingCode, language = 'javascript' }: CodeEditorProps) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col h-full relative">
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

      {/* Footer */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-2 border-t border-black/[0.06] flex-shrink-0">
        <button
          onClick={onClear}
          disabled={isGenerating || isApplyingCode}
          title={t('codeEditor.clear')}
          className="h-7 px-2.5 flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          <Trash2 size={12} />
          <span>{t('codeEditor.clear')}</span>
        </button>
        <button
          onClick={onApply}
          disabled={isGenerating || isApplyingCode || !code?.trim()}
          title={t('codeEditor.applyToCanvas')}
          className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isApplyingCode ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
          <span>{t('codeEditor.applyToCanvas')}</span>
        </button>
      </div>
    </div>
  );
}
