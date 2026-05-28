'use client';

import { useState, useRef, useEffect, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import ImageUpload from './ImageUpload';
import LoadingOverlay from './LoadingOverlay';
import { generateImagePrompt } from '@/lib/image-utils';
import { CHART_TYPES } from '@/lib/constants';
import type { SourceType, ImageObject } from '@/types';

interface ChatProps {
  onSendMessage: (message: string | { text: string; image: unknown; chartType: string }, chartType: string, source: SourceType) => void;
  isGenerating: boolean;
  initialInput?: string;
  initialChartType?: string;
}

export default function Chat({ onSendMessage, isGenerating, initialInput = '', initialChartType = 'auto' }: ChatProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'image'>('text');
  const [input, setInput] = useState(initialInput);
  const [chartType, setChartType] = useState(initialChartType);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileStatus, setFileStatus] = useState<'' | 'parsing' | 'success' | 'error'>('');
  const [fileError, setFileError] = useState('');
  const [selectedImage, setSelectedImage] = useState<(ImageObject & { previewUrl: string; file: File }) | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [canGenerate, setCanGenerate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSubmitSourceRef = useRef<SourceType>('text');

  useEffect(() => {
    if (lastSubmitSourceRef.current === 'text') {
      setInput(initialInput);
    } else {
      lastSubmitSourceRef.current = 'text';
    }
  }, [initialInput]);

  useEffect(() => {
    setChartType(initialChartType);
  }, [initialChartType]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isGenerating) {
      lastSubmitSourceRef.current = 'text';
      onSendMessage(input.trim(), chartType, 'text');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileStatus('');
      setFileError('');
      setFileContent('');
      setCanGenerate(false);
      return;
    }

    const validExtensions = ['.md', '.txt'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setFileError('请选择 .md 或 .txt 文件');
      setFileStatus('error');
      setCanGenerate(false);
      return;
    }

    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileError('文件大小不能超过 1MB');
      setFileStatus('error');
      setCanGenerate(false);
      return;
    }

    setSelectedFile(file);
    setFileStatus('parsing');
    setFileError('');
    setFileContent('');
    setCanGenerate(false);

    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string' && content.trim()) {
        setFileStatus('success');
        setFileContent(content.trim());
        setCanGenerate(true);
      } else {
        setFileError('文件内容为空');
        setFileStatus('error');
        setCanGenerate(false);
      }
    };

    reader.onerror = () => {
      setFileError('文件读取失败');
      setFileStatus('error');
      setCanGenerate(false);
    };

    reader.readAsText(file);
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileGenerate = () => {
    if (fileContent && !isGenerating) {
      lastSubmitSourceRef.current = 'file';
      onSendMessage(fileContent, chartType, 'file');
      setCanGenerate(false);
    }
  };

  const handleImageSelect = (imageData: (ImageObject & { previewUrl: string; file: File }) | null) => {
    setSelectedImage(imageData);
    if (imageData) {
      setCanGenerate(true);
    } else {
      setCanGenerate(false);
    }
  };

  const handleImageSubmit = () => {
    if (selectedImage && !isGenerating) {
      lastSubmitSourceRef.current = 'image';
      const imagePrompt = generateImagePrompt(chartType);
      const messageData = {
        text: imagePrompt,
        image: selectedImage,
        chartType,
      };
      onSendMessage(messageData, chartType, 'image');
      setCanGenerate(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => { setActiveTab('text'); setCanGenerate(false); }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${activeTab === 'text' ? 'bg-white text-gray-900 border-b-2 border-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
        >
          文本输入
        </button>
        <button
          onClick={() => { setActiveTab('file'); setCanGenerate(!!fileContent); }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${activeTab === 'file' ? 'bg-white text-gray-900 border-b-2 border-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
        >
          文件上传
        </button>
        <button
          onClick={() => { setActiveTab('image'); setCanGenerate(!!selectedImage); }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${activeTab === 'image' ? 'bg-white text-gray-900 border-b-2 border-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
        >
          图片上传
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Text Input Tab */}
        {activeTab === 'text' && (
          <div className="flex-1 flex flex-col p-4 relative">
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
              <div className="mb-3">
                <select
                  id="chart-type-text"
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  disabled={isGenerating}
                >
                  {Object.entries(CHART_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述您想要创建的图表..."
                  className="w-full h-full pl-3 pr-12 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none text-sm scrollbar-hide"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  disabled={isGenerating}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isGenerating}
                  className="absolute right-2 bottom-2 p-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
                  title={isGenerating ? "生成中..." : "发送"}
                >
                  {isGenerating ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
            <LoadingOverlay isVisible={isGenerating} message="正在生成图表..." />
          </div>
        )}

        {/* File Upload Tab */}
        {activeTab === 'file' && (
          <div className="flex-1 flex flex-col items-center p-4 relative">
            <div className="w-full max-w-md mb-6">
              <select
                id="chart-type-file"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                disabled={isGenerating || fileStatus === 'parsing'}
              >
                {Object.entries(CHART_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600 mb-2">上传 Markdown 或文本文件</p>
              <p className="text-xs text-gray-400">支持 .md 和 .txt 格式，最大 1MB</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              onChange={handleFileChange}
              className="hidden"
              disabled={isGenerating || fileStatus === 'parsing'}
            />

            <button
              onClick={handleFileButtonClick}
              disabled={isGenerating || fileStatus === 'parsing'}
              className="px-6 py-3 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
            >
              {(isGenerating || fileStatus === 'parsing') ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
              <span>{fileStatus === 'parsing' ? '解析中...' : isGenerating ? '生成中...' : '选择文件'}</span>
            </button>

            {selectedFile && (
              <div className="mt-6 w-full max-w-md">
                <div className={`p-4 rounded border ${fileStatus === 'success' ? 'bg-green-50 border-green-200' : fileStatus === 'error' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center space-x-3">
                    {fileStatus === 'parsing' && (
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    )}
                    {fileStatus === 'success' && (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {fileStatus === 'error' && (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                      {fileStatus === 'success' && !isGenerating && <p className="text-xs text-green-600 mt-1">文件已上传，可以开始生成</p>}
                      {fileStatus === 'success' && isGenerating && <p className="text-xs text-blue-600 mt-1">正在生成图表...</p>}
                      {fileStatus === 'error' && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
                      {fileStatus === 'parsing' && <p className="text-xs text-blue-600 mt-1">正在解析文件...</p>}
                    </div>
                  </div>
                </div>

                {fileStatus === 'success' && !isGenerating && (
                  <div className="mt-4">
                    <button
                      onClick={handleFileGenerate}
                      disabled={!canGenerate}
                      className="w-full px-4 py-3 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>开始生成</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            <LoadingOverlay isVisible={isGenerating || fileStatus === 'parsing'} message={fileStatus === 'parsing' ? '正在解析文件...' : '正在生成图表...'} />
          </div>
        )}

        {/* Image Upload Tab */}
        {activeTab === 'image' && (
          <div className="flex-1 flex flex-col relative">
            <ImageUpload
              onImageSelect={handleImageSelect}
              isGenerating={isGenerating}
              chartType={chartType}
              onChartTypeChange={setChartType}
              onImageGenerate={handleImageSubmit}
            />
            <LoadingOverlay isVisible={isGenerating} message="正在识别图片内容并生成图表..." />
          </div>
        )}
      </div>
    </div>
  );
}
