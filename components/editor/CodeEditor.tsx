'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Editor, loader, type OnMount } from '@monaco-editor/react';
import { Loader2, X } from 'lucide-react';
import { useLocale } from '@/lib/locales';

// Lazy-init Monaco from local package (avoids CDN Tracking Prevention warnings)
let monacoLoadPromise: Promise<void> | null = null;
function ensureMonacoLoaded(): Promise<void> {
  if (!monacoLoadPromise) {
    monacoLoadPromise = import('monaco-editor').then((monaco) => {
      loader.config({ monaco: monaco.default || monaco });
    }).catch((e) => {
      console.error('[CodeEditor] Monaco 加载失败:', e);
      monacoLoadPromise = null;
    });
  }
  return monacoLoadPromise;
}

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

/** 自定义滚动条 — 通过 Monaco editor.onDidScrollChange 同步 */
function CustomScrollbar({ editor }: { editor: import('monaco-editor').editor.IStandaloneCodeEditor }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbH, setThumbH] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [show, setShow] = useState(false);
  const dragState = useRef({ startY: 0, startTop: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 从 Monaco 读取滚动状态并更新滑块位置 */
  const syncFromEditor = useCallback(() => {
    const ev = editor.getScrollTop();
    const scrollHeight = editor.getScrollHeight();
    const clientHeight = editor.getLayoutInfo().height;
    if (scrollHeight <= clientHeight + 1) { setShow(false); return; }
    setShow(true);
    const trackH = clientHeight;
    const ratio = clientHeight / scrollHeight;
    const h = Math.max(30, trackH * ratio);
    const maxScroll = scrollHeight - clientHeight;
    const maxTop = trackH - h;
    setThumbH(h);
    setThumbTop(maxScroll > 0 ? (ev / maxScroll) * maxTop : 0);
  }, [editor]);

  // 监听 Monaco 滚动事件
  useEffect(() => {
    const disposable = editor.onDidScrollChange(() => {
      syncFromEditor();
      setShow(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => { if (!hover && !dragging) setShow(false); }, 1500);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始同步
    syncFromEditor();
    return () => disposable.dispose();
  }, [editor, syncFromEditor, hover, dragging]);

  // 拖拽滚动
  useEffect(() => {
    if (!dragging) return;
    const scrollHeight = editor.getScrollHeight();
    const clientHeight = editor.getLayoutInfo().height;
    const trackH = clientHeight;
    const thumbRange = trackH - thumbH;
    const scrollRange = scrollHeight - clientHeight;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - dragState.current.startY;
      const newTop = Math.max(0, Math.min(thumbRange, dragState.current.startTop + delta));
      editor.setScrollTop(thumbRange > 0 ? (newTop / thumbRange) * scrollRange : 0);
    };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragging, editor, thumbH]);

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-0 bottom-0 w-[8px] z-20"
      style={{ opacity: dragging || hover ? 1 : 0.6, transition: 'opacity 200ms' }}
      onMouseEnter={() => { setHover(true); if (hideTimer.current) clearTimeout(hideTimer.current); }}
      onMouseLeave={() => { setHover(false); if (!dragging) { hideTimer.current = setTimeout(() => setShow(false), 1200); } }}
    >
      <div
        className="absolute right-[1px] w-[6px] rounded-full cursor-pointer"
        style={{
          top: `${thumbTop}px`,
          height: `${thumbH}px`,
          background: hover || dragging ? 'var(--scrollbar-thumb-hover)' : 'var(--scrollbar-thumb)',
          transition: dragging ? 'none' : 'background 150ms',
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          dragState.current = { startY: e.clientY, startTop: thumbTop };
          setDragging(true);
        }}
      />
    </div>
  );
}

export default function CodeEditor({ code, onChange, onApply, onClear, jsonError, onClearJsonError, isGenerating, isApplyingCode, language = 'javascript' }: CodeEditorProps) {
  const { t } = useLocale();
  const [editorInstance, setEditorInstance] = useState<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editor) => {
    setEditorInstance(editor);
  }, []);

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
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          defaultLanguage={language}
          value={code}
          onChange={onChange}
          theme="vs-light"
          onMount={handleMount}
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
            scrollbar: {
              vertical: 'hidden',
              verticalScrollbarSize: 0,
              horizontal: 'hidden',
              horizontalScrollbarSize: 0,
            },
          }}
        />
        {/* 自定义滚动条 */}
        {editorInstance && <CustomScrollbar editor={editorInstance} />}
        {/* 生成中加载动画 */}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-glass)] backdrop-blur-sm z-10">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-warm-solid)] shadow-lg border border-[var(--border)]">
              <Loader2 size={16} className="animate-spin text-[var(--accent-indigo)]" />
              <span className="text-sm text-[var(--fg)]">{t('common.loading')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
