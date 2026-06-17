'use client';

import { useReducer, useEffect, useCallback } from 'react';
import type { LLMConfig } from '@/lib/types';
import * as api from '@/lib/api/client';

/** 配置状态 */
interface ConfigState {
  config: LLMConfig | null;
  loaded: boolean;
}

type ConfigAction =
  | { type: 'SET_CONFIG'; payload: LLMConfig | null }
  | { type: 'LOADED' };

function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case 'SET_CONFIG': return { ...state, config: action.payload };
    case 'LOADED': return { ...state, loaded: true };
    default: return state;
  }
}

export function useEditorConfig() {
  const [configState, dispatchConfig] = useReducer(configReducer, { config: null, loaded: false });
  const { config, loaded } = configState;

  const loadConfig = useCallback(async () => {
    try {
      const data = await api.fetchConfigs();
      if (data.activeConfigId) {
        const active = data.configs.find(c => c.id === data.activeConfigId);
        if (active) dispatchConfig({ type: 'SET_CONFIG', payload: active });
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      dispatchConfig({ type: 'LOADED' });
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleConfigSelect = useCallback((selectedConfig: LLMConfig | null) => {
    if (selectedConfig) dispatchConfig({ type: 'SET_CONFIG', payload: selectedConfig });
  }, []);

  return {
    config,
    configLoaded: loaded,
    handleConfigSelect,
  };
}
