'use client';

import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { Upload, X, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import {
  validateImage,
  createImageObject,
  getImagePreviewUrl,
} from '@/lib/image-utils';
import { CHART_TYPES } from '@/lib/constants';
import type { ImageObject } from '@/types';

interface ImageUploadProps {
  onImageSelect?: (imageData: (ImageObject & { previewUrl: string; file: File }) | null) => void;
  isGenerating: boolean;
  chartType: string;
  onChartTypeChange?: (chartType: string) => void;
  onImageGenerate?: () => void;
}

export default function ImageUpload({ onImageSelect, isGenerating, chartType, onChartTypeChange, onImageGenerate }: ImageUploadProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'' | 'uploading' | 'success' | 'error'>('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    setUploadStatus('uploading');
    setErrorMessage('');
    try {
      const validation = validateImage(file);
      if (!validation.isValid) throw new Error(validation.error);
      const previewUrl = await getImagePreviewUrl(file);
      setImagePreview(previewUrl);
      setSelectedFile(file);
      const imageObject = await createImageObject(file);
      setUploadStatus('success');
      if (onImageSelect) onImageSelect({ ...imageObject, previewUrl, file });
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage((error as Error).message);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUploadClick = () => {
    if (!isGenerating && uploadStatus !== 'uploading') fileInputRef.current?.click();
  };

  const handleDragEnter = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current++; if (e.dataTransfer.items?.length > 0) setIsDragging(true); };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current--; if (dragCounterRef.current === 0) setIsDragging(false); };
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); dragCounterRef.current = 0; if (e.dataTransfer.files?.length > 0) handleFileSelect(e.dataTransfer.files[0]); };

  const handleClearImage = () => {
    setImagePreview(null); setSelectedFile(null); setUploadStatus(''); setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onImageSelect) onImageSelect(null);
  };

  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Chart Type Selector */}
      <div className="w-full mb-4">
        <select
          id="chart-type-image"
          value={chartType}
          onChange={(e) => onChartTypeChange?.(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-black/4 border border-black/5 rounded-xl text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/30 appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center] pr-7"
          disabled={isGenerating || uploadStatus === 'uploading'}
        >
          {Object.entries(CHART_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {!selectedFile ? (
        <div
          className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all duration-300 ${
            isDragging
              ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5'
              : 'border-black/8 hover:border-black/15'
          }`}
          onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
        >
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-3">
              <ImageIcon size={24} className="text-[var(--muted)]" />
            </div>
            <p className="text-sm text-[var(--fg)] mb-1">上传图片进行识别</p>
            <p className="text-xs text-[var(--muted)]">支持 JPG、PNG、WebP、GIF，最大 5MB</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInputChange} className="hidden" disabled={isGenerating || uploadStatus === 'uploading'} />
          <button
            onClick={handleUploadClick}
            disabled={isGenerating || uploadStatus === 'uploading'}
            className="h-9 px-5 flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {uploadStatus === 'uploading' ? <><Loader2 size={14} className="animate-spin" /><span>处理中...</span></> : isGenerating ? <><Loader2 size={14} className="animate-spin" /><span>生成中...</span></> : <><Upload size={14} /><span>选择图片</span></>}
          </button>
          {isDragging && <p className="mt-3 text-sm text-[var(--accent-indigo)]">松开鼠标上传图片</p>}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex justify-center relative bg-black/3 rounded-2xl overflow-hidden border border-black/5">
            {imagePreview && <img src={imagePreview} alt="预览" className="w-full object-contain" />}
            <button onClick={handleClearImage} disabled={isGenerating || uploadStatus === 'uploading'} className="absolute top-3 right-3 w-8 h-8 bg-white/80 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white transition-all duration-200 disabled:opacity-50" title="删除图片">
              <X size={14} className="text-[var(--fg)]" />
            </button>
            {uploadStatus === 'success' && (
              <div className="absolute top-3 left-3 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle size={14} className="text-white" />
              </div>
            )}
            {uploadStatus === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <Loader2 size={24} className="text-[var(--accent-indigo)] animate-spin" />
              </div>
            )}
            {selectedFile && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-xs font-medium text-white truncate">{selectedFile.name}</p>
              </div>
            )}
          </div>
          {errorMessage && <div className="mt-2 px-3 py-2 bg-red-50/80 rounded-xl"><p className="text-xs text-red-600">{errorMessage}</p></div>}
          {uploadStatus === 'success' && !isGenerating && (
            <button onClick={onImageGenerate} className="w-full mt-2 h-10 flex items-center justify-center gap-2 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] transition-all duration-200 text-sm font-medium">
              <Upload size={16} /><span>开始生成</span>
            </button>
          )}
          {isGenerating && uploadStatus === 'success' && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-[var(--accent-indigo)]">
              <Loader2 size={14} className="animate-spin" /><span>正在识别...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
