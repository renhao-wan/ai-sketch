'use client';

import { useState, useRef, useEffect, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paperclip,
  Image,
  Sparkles,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Upload,
} from 'lucide-react';
import {
  validateImage,
  createImageObject,
  getImagePreviewUrl,
  generateImagePrompt,
} from '@/lib/image-utils';

const FORMATS = [
  { key: 'excalidraw', label: 'Excalidraw' },
  { key: 'mermaid', label: 'Mermaid' },
  { key: 'drawio', label: 'Draw.io' },
];

export default function AIPromptBox() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const [activeFormat, setActiveFormat] = useState('excalidraw');
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileStatus, setFileStatus] = useState<'' | 'parsing' | 'success' | 'error'>('');
  const [fileError, setFileError] = useState('');

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [prompt]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFileContent('');
    setFileStatus('');
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImage(file);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const canGenerate = (): boolean => {
    if (isGenerating) return false;
    return !!(prompt.trim() || (fileStatus === 'success' && fileContent) || selectedImage);
  };

  const handleGenerate = async () => {
    if (!canGenerate()) return;
    setIsGenerating(true);

    try {
      if (selectedImage) {
        const imageObject = await createImageObject(selectedImage);
        const previewUrl = await getImagePreviewUrl(selectedImage);
        const imageData = { ...imageObject, previewUrl };
        const text = prompt.trim() || generateImagePrompt(activeFormat === 'excalidraw' ? 'auto' : activeFormat);
        sessionStorage.setItem('ai-sketch-init-data', JSON.stringify({
          type: 'image',
          data: { text, image: imageData },
          format: activeFormat,
        }));
        router.push('/editor?source=image');
      } else if (fileStatus === 'success' && fileContent) {
        const data = prompt.trim()
          ? `用户指令：\n${prompt.trim()}\n\n参考内容：\n${fileContent}`
          : fileContent;
        sessionStorage.setItem('ai-sketch-init-data', JSON.stringify({
          type: 'file',
          data,
          format: activeFormat,
        }));
        router.push('/editor?source=file');
      } else if (prompt.trim()) {
        const params = new URLSearchParams({ prompt: prompt.trim(), format: activeFormat });
        router.push(`/editor?${params.toString()}`);
      }
    } catch (err) {
      setFileError((err as Error).message);
      setFileStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      processImage(file);
    } else {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.md', '.txt'].includes(ext)) {
      setFileError('请选择 .md 或 .txt 文件');
      setFileStatus('error');
      return;
    }
    if (file.size > 1024 * 1024) {
      setFileError('文件大小不能超过 1MB');
      setFileStatus('error');
      return;
    }
    handleClearImage();
    setSelectedFile(file);
    setFileStatus('parsing');
    setFileError('');
    const reader = new FileReader();
    reader.onload = () => {
      const content = ((reader.result as string) || '').trim();
      if (content) { setFileContent(content); setFileStatus('success'); }
      else { setFileError('文件内容为空'); setFileStatus('error'); }
    };
    reader.onerror = () => { setFileError('文件读取失败'); setFileStatus('error'); };
    reader.readAsText(file);
  };

  const processImage = async (file: File) => {
    try {
      const validation = validateImage(file);
      if (!validation.isValid) { setFileError(validation.error!); setFileStatus('error'); return; }
      handleClearFile();
      setSelectedImage(file);
      const previewUrl = await getImagePreviewUrl(file);
      setImagePreview(previewUrl);
    } catch (err) { setFileError((err as Error).message); setFileStatus('error'); }
  };

  const hasAttachment = selectedFile || selectedImage;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="relative rounded-3xl bg-white/60 backdrop-blur-2xl border border-white/10 shadow-[0_10px_60px_rgba(0,0,0,0.08)] overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--accent-indigo)]/5 border-2 border-dashed border-[var(--accent-indigo)]/30 rounded-3xl pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-[var(--accent-indigo)]" />
              <span className="text-sm font-medium text-[var(--accent-indigo)]">拖放文件或图片到此处</span>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 pt-5 pb-3">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasAttachment ? '补充指令（可选）...' : '描述你想要创建的图表...'}
            rows={1}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none"
            style={{ minHeight: '48px' }}
          />

          {/* Attachment */}
          {(selectedFile || selectedImage) && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/[0.03] border border-black/[0.06]">
              {selectedFile && (
                <>
                  {fileStatus === 'parsing' && <Loader2 size={13} className="animate-spin text-[var(--muted)] flex-shrink-0" />}
                  {fileStatus === 'success' && <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />}
                  {fileStatus === 'error' && <AlertCircle size={13} className="text-red-500 flex-shrink-0" />}
                  <span className="text-xs text-[var(--fg)] truncate flex-1">{selectedFile.name}</span>
                  {fileStatus === 'success' && <span className="text-[10px] text-[var(--muted)]/60 flex-shrink-0">{fileContent.length} 字符</span>}
                  {fileStatus === 'error' && <span className="text-[10px] text-red-500 flex-shrink-0">{fileError}</span>}
                  <button onClick={handleClearFile} className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex-shrink-0 ml-1">
                    <X size={13} />
                  </button>
                </>
              )}
              {selectedImage && (
                <>
                  {imagePreview && <img src={imagePreview} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                  <span className="text-xs text-[var(--fg)] truncate flex-1">{selectedImage.name}</span>
                  <button onClick={handleClearImage} className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex-shrink-0 ml-1">
                    <X size={13} />
                  </button>
                </>
              )}
            </div>
          )}
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
            <span className="text-[10px] text-[var(--muted)]/40">单个附件</span>
            <input ref={fileInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleFileChange} />
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
                selectedFile ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5'
              }`}
              title="上传文件"
            >
              <Paperclip size={18} />
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
                selectedImage ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5'
              }`}
              title="上传图片"
            >
              <Image size={18} />
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate()}
              className="h-9 px-5 flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isGenerating ? (
                <><Loader2 size={15} className="animate-spin" /><span>生成中...</span></>
              ) : (
                <><Sparkles size={15} /><span>生成</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
