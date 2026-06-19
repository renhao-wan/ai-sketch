'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/locales';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { X, Zap, Star, Heart, Coffee, Music, Camera, Code, Database, FileText, Folder, Globe, Home, Image, Lock, Mail, Map, Mic, Moon, Phone, Pin, Search, Settings, Shield, Sun, Terminal, User, Video, Wifi, Cloud, Download, Upload } from 'lucide-react';
import type { CustomAction } from '@/lib/db/custom-action-manager';

// 可选图标列表
const ICON_OPTIONS = [
  { name: 'Zap', icon: Zap },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Coffee', icon: Coffee },
  { name: 'Music', icon: Music },
  { name: 'Camera', icon: Camera },
  { name: 'Code', icon: Code },
  { name: 'Database', icon: Database },
  { name: 'FileText', icon: FileText },
  { name: 'Folder', icon: Folder },
  { name: 'Globe', icon: Globe },
  { name: 'Home', icon: Home },
  { name: 'Image', icon: Image },
  { name: 'Lock', icon: Lock },
  { name: 'Mail', icon: Mail },
  { name: 'Map', icon: Map },
  { name: 'Mic', icon: Mic },
  { name: 'Moon', icon: Moon },
  { name: 'Phone', icon: Phone },
  { name: 'Pin', icon: Pin },
  { name: 'Search', icon: Search },
  { name: 'Settings', icon: Settings },
  { name: 'Shield', icon: Shield },
  { name: 'Sun', icon: Sun },
  { name: 'Terminal', icon: Terminal },
  { name: 'User', icon: User },
  { name: 'Video', icon: Video },
  { name: 'Wifi', icon: Wifi },
  { name: 'Cloud', icon: Cloud },
  { name: 'Download', icon: Download },
  { name: 'Upload', icon: Upload },
];

interface ActionEditorProps {
  action: CustomAction | null;
  onClose: () => void;
  onSave: () => void;
}

export function ActionEditor({ action, onClose, onSave }: ActionEditorProps) {
  const { t } = useLocale();
  const { showNotification } = useNotification();
  const [name, setName] = useState(action?.name || '');
  const [prompt, setPrompt] = useState(action?.prompt || '');
  const [icon, setIcon] = useState(action?.icon || 'Zap');
  const [actionType, setActionType] = useState<'modify' | 'explain'>(action?.action_type || 'modify');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = !!action;

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) return;

    setSaving(true);
    try {
      const url = isEditing ? `/api/custom-actions/${action.id}` : '/api/custom-actions';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          prompt: prompt.trim(),
          icon,
          action_type: actionType,
        }),
      });

      if (!response.ok) {
        throw new Error('保存失败');
      }

      showNotification(
        isEditing ? '编辑成功' : '创建成功',
        `操作"${name.trim()}"已${isEditing ? '更新' : '创建'}`,
        'success'
      );
      onSave();
    } catch (error) {
      console.error('Failed to save action:', error);
      showNotification('保存失败', (error as Error).message || '操作保存失败，请稍后重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-[var(--bg)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--fg)]">
            {isEditing ? t('aiActions.editAction') : t('aiActions.createAction')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {/* 操作名称 */}
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
              {t('aiActions.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('aiActions.namePlaceholder')}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
            />
          </div>

          {/* 提示词 */}
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
              {t('aiActions.prompt')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('aiActions.promptPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm resize-none"
            />
          </div>

          {/* 高级设置 */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-[var(--accent-indigo)] hover:underline"
            >
              {t('aiActions.advancedSettings')}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
                {/* 图标选择 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                    {t('aiActions.icon')}
                  </label>
                  <div className="grid grid-cols-10 gap-2">
                    {ICON_OPTIONS.map(({ name, icon: IconComponent }) => (
                      <button
                        key={name}
                        onClick={() => setIcon(name)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                          icon === name
                            ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] ring-2 ring-[var(--accent-indigo)]'
                            : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                        }`}
                      >
                        <IconComponent size={14} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 操作类型 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                    {t('aiActions.actionType')}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-warm-hover)] transition-colors">
                      <input
                        type="radio"
                        name="actionType"
                        value="modify"
                        checked={actionType === 'modify'}
                        onChange={() => setActionType('modify')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-[var(--fg)]">
                          {t('aiActions.actionTypeModify')}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {t('aiActions.actionTypeModifyDesc')}
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-warm-hover)] transition-colors">
                      <input
                        type="radio"
                        name="actionType"
                        value="explain"
                        checked={actionType === 'explain'}
                        onChange={() => setActionType('explain')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-[var(--fg)]">
                          {t('aiActions.actionTypeExplain')}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {t('aiActions.actionTypeExplainDesc')}
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors"
          >
            {t('aiActions.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !prompt.trim() || saving}
            className="px-4 py-2 text-sm rounded-xl bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '...' : (isEditing ? t('aiActions.save') : t('aiActions.create'))}
          </button>
        </div>
      </div>
    </div>
  );
}
