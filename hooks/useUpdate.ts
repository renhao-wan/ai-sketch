'use client';

/**
 * 自动更新 Hook
 * 监听主进程的更新状态，提供操作方法
 */

import { useState, useEffect, useCallback } from 'react';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateInfo {
  version?: string;
  releaseDate?: string;
  releaseName?: string;
}

interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: number;
  error: string | null;
}

export function useUpdate() {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    info: null,
    progress: 0,
    error: null,
  });

  useEffect(() => {
    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!electronAPI?.update) return;

    const cleanup = electronAPI.update.onStatus(({ status, data }) => {
      console.log('[useUpdate] status:', status, data);
      switch (status) {
        case 'checking':
          setState(prev => ({ ...prev, status: 'checking', error: null }));
          break;
        case 'available':
          setState(prev => ({ ...prev, status: 'available', info: data as UpdateInfo, error: null }));
          break;
        case 'not-available':
          setState(prev => ({ ...prev, status: 'not-available', info: null }));
          break;
        case 'downloading':
          setState(prev => ({
            ...prev,
            status: 'downloading',
            progress: (data as { percent?: number })?.percent ?? 0,
          }));
          break;
        case 'downloaded':
          setState(prev => ({ ...prev, status: 'downloaded', progress: 100 }));
          break;
        case 'error':
          setState(prev => ({ ...prev, status: 'error', error: data as string }));
          break;
      }
    });

    return cleanup;
  }, []);

  const checkForUpdates = useCallback(() => {
    console.log('[useUpdate] check called, electronAPI:', !!window.electronAPI, 'update:', !!window.electronAPI?.update);
    window.electronAPI?.update?.check();
  }, []);

  const downloadUpdate = useCallback(() => {
    window.electronAPI?.update?.download();
  }, []);

  const installUpdate = useCallback(() => {
    window.electronAPI?.update?.install();
  }, []);

  return {
    ...state,
    isElectron: typeof window !== 'undefined' && !!window.electronAPI?.update,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
