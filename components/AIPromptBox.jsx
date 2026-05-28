'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Image, Sparkles, Loader2 } from 'lucide-react';

const FORMATS = [
  { key: 'excalidraw', label: 'Excalidraw' },
  { key: 'mermaid', label: 'Mermaid' },
  { key: 'drawio', label: 'Draw.io' },
];

export default function AIPromptBox() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [activeFormat, setActiveFormat] = useState('excalidraw');
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [prompt]);

  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    // Navigate to editor with prompt as query param
    const params = new URLSearchParams({
      prompt: prompt.trim(),
      format: activeFormat,
    });
    router.push(`/editor?${params.toString()}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative rounded-3xl bg-white/60 backdrop-blur-2xl border border-white/10 shadow-[0_10px_60px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Input Area */}
        <div className="px-6 pt-5 pb-3">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想要创建的图表..."
            rows={1}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none"
            style={{ minHeight: '48px' }}
          />
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-4 pb-4 pt-1">
          {/* Left - Format Selector */}
          <div className="segmented-control">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFormat(f.key)}
                className={`segmented-control-item ${activeFormat === f.key ? 'active' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200">
              <Paperclip size={18} />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200">
              <Image size={18} />
            </button>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="h-9 px-5 flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>生成</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
