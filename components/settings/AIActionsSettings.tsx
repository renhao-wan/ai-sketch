'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/locales';
import { Plus, GripVertical, Trash2, Edit2, Zap } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { ActionEditor } from '@/components/settings/ActionEditor';
import type { CustomAction, CanvasAction } from '@/lib/db/custom-action-manager';

// 内置操作定义
const BUILTIN_ACTIONS = [
  { id: 'layout', name: '布局优化', icon: 'LayoutGrid' },
  { id: 'beautify', name: '美化', icon: 'Palette' },
  { id: 'simplify', name: '简化', icon: 'Minimize2' },
  { id: 'explain', name: '解释', icon: 'Sparkles' },
];

export function AIActionsSettings() {
  const { t } = useLocale();
  const [canvasActions, setCanvasActions] = useState<CanvasAction[]>([]);
  const [customActions, setCustomActions] = useState<CustomAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAction, setEditingAction] = useState<CustomAction | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [canvasRes, customRes] = await Promise.all([
        fetch('/api/canvas-actions'),
        fetch('/api/custom-actions'),
      ]);
      const canvasData = await canvasRes.json();
      const customData = await customRes.json();
      setCanvasActions(canvasData);
      setCustomActions(customData);
    } catch (error) {
      console.error('Failed to load actions:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新画布操作
  const updateCanvasActions = async (newActions: Omit<CanvasAction, 'id'>[]) => {
    try {
      await fetch('/api/canvas-actions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: newActions }),
      });
      await loadData();
    } catch (error) {
      console.error('Failed to update canvas actions:', error);
    }
  };

  // 删除自定义操作
  const deleteAction = async (id: string) => {
    if (!confirm(t('aiActions.deleteConfirm'))) return;
    try {
      await fetch(`/api/custom-actions/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      console.error('Failed to delete action:', error);
    }
  };

  // 切换操作显示状态
  const toggleAction = (actionType: 'builtin' | 'custom', actionId: string) => {
    const exists = canvasActions.find(a => a.action_type === actionType && a.action_id === actionId);

    if (exists) {
      // 移除
      const newActions = canvasActions.filter(a => !(a.action_type === actionType && a.action_id === actionId));
      updateCanvasActions(newActions);
    } else {
      // 添加（检查数量限制）
      if (canvasActions.length >= 4) {
        alert(t('aiActions.maxActions'));
        return;
      }
      const newActions = [...canvasActions, { action_type: actionType, action_id: actionId, sort_order: canvasActions.length }];
      updateCanvasActions(newActions);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-[var(--muted)]">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 画布操作区域 */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">
          {t('aiActions.canvasActions')}
        </h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          {t('aiActions.canvasActionsDesc')}
        </p>

        <div className="space-y-2">
          {canvasActions.map((action, index) => {
            const isBuiltin = action.action_type === 'builtin';
            const builtin = isBuiltin ? BUILTIN_ACTIONS.find(b => b.id === action.action_id) : null;
            const custom = !isBuiltin ? customActions.find(c => c.id === action.action_id) : null;

            return (
              <div
                key={`${action.action_type}-${action.action_id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
              >
                <GripVertical size={16} className="text-[var(--muted)] cursor-move" />
                <span className="text-lg">{isBuiltin ? '⚡' : (custom?.icon || 'Zap')}</span>
                <span className="flex-1 text-sm text-[var(--fg)]">
                  {isBuiltin ? builtin?.name : custom?.name}
                </span>
                <span className="text-xs text-[var(--muted)] px-2 py-1 rounded bg-[var(--surface-warm-hover)]">
                  {isBuiltin ? t('aiActions.builtin') : t('aiActions.custom')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 自定义操作区域 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--fg)]">
            {t('aiActions.customActions')}
          </h3>
          <button
            onClick={() => {
              setEditingAction(null);
              setShowEditor(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo)]/90 transition-colors"
          >
            <Plus size={14} />
            {t('aiActions.createAction')}
          </button>
        </div>

        {customActions.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm">
            {t('aiActions.noCustomActions')}
          </div>
        ) : (
          <div className="space-y-2">
            {customActions.map(action => (
              <div
                key={action.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
              >
                <span className="text-lg">{action.icon || 'Zap'}</span>
                <div className="flex-1">
                  <div className="text-sm text-[var(--fg)]">{action.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {action.action_type === 'modify' ? t('aiActions.actionTypeModify') : t('aiActions.actionTypeExplain')}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip content={t('aiActions.editAction')}>
                    <button
                      onClick={() => {
                        setEditingAction(action);
                        setShowEditor(true);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('aiActions.deleteAction')}>
                    <button
                      onClick={() => deleteAction(action.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                  <button
                    onClick={() => toggleAction('custom', action.id)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      canvasActions.some(a => a.action_type === 'custom' && a.action_id === action.id)
                        ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
                        : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                    }`}
                  >
                    <Zap size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑器弹窗 */}
      {showEditor && (
        <ActionEditor
          action={editingAction}
          onClose={() => {
            setShowEditor(false);
            setEditingAction(null);
          }}
          onSave={async () => {
            setShowEditor(false);
            setEditingAction(null);
            await loadData();
          }}
        />
      )}
    </div>
  );
}
