'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/lib/locales';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { Plus, GripVertical, Trash2, Edit2, Zap, Star, Heart, Coffee, Music, Camera, Code, Database, FileText, Folder, Globe, Home, Image, Lock, Mail, Map, Mic, Moon, Phone, Pin, Search, Settings, Shield, Sun, Terminal, User, Video, Wifi, Cloud, Download, Upload, LayoutGrid, Palette, Minimize2, Sparkles, ChevronUp, ChevronDown, X } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { ActionEditor } from '@/components/settings/ActionEditor';
import type { CustomAction, CanvasAction } from '@/lib/db/custom-action-manager';

// 图标映射
const ICON_MAP: Record<string, typeof Zap> = {
  Zap, Star, Heart, Coffee, Music, Camera, Code, Database, FileText, Folder, Globe, Home, Image, Lock, Mail, Map, Mic, Moon, Phone, Pin, Search, Settings, Shield, Sun, Terminal, User, Video, Wifi, Cloud, Download, Upload, LayoutGrid, Palette, Minimize2, Sparkles,
};

// 获取图标组件
const getIconComponent = (iconName: string) => {
  return ICON_MAP[iconName] || Zap;
};

// 内置操作定义
const BUILTIN_ACTIONS = [
  { id: 'layout', name: '布局优化', icon: 'LayoutGrid' },
  { id: 'beautify', name: '美化', icon: 'Palette' },
  { id: 'simplify', name: '简化', icon: 'Minimize2' },
  { id: 'explain', name: '解释', icon: 'Sparkles' },
];

export function AIActionsSettings() {
  const { t } = useLocale();
  const { showNotification } = useNotification();
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
    try {
      await fetch(`/api/custom-actions/${id}`, { method: 'DELETE' });
      showNotification(t('aiActions.deleteAction'), '操作已删除', 'success');
      await loadData();
    } catch (error) {
      console.error('Failed to delete action:', error);
      showNotification(t('error.title'), '删除操作失败', 'error');
    }
  };

  // 从画布移除操作（不删除操作本身）
  const removeFromCanvas = (actionType: 'builtin' | 'custom', actionId: string) => {
    const newActions = canvasActions.filter(a => !(a.action_type === actionType && a.action_id === actionId));
    updateCanvasActions(newActions);
  };

  // 添加到画布
  const addToCanvas = (actionType: 'builtin' | 'custom', actionId: string) => {
    if (canvasActions.length >= 4) {
      showNotification(t('aiActions.maxActions'), '', 'warning');
      return;
    }
    const newActions = [...canvasActions, { action_type: actionType, action_id: actionId, sort_order: canvasActions.length }];
    updateCanvasActions(newActions);
  };

  // 检查操作是否在画布上
  const isOnCanvas = (actionType: 'builtin' | 'custom', actionId: string) => {
    return canvasActions.some(a => a.action_type === actionType && a.action_id === actionId);
  };

  // 上移操作
  const moveActionUp = (index: number) => {
    if (index === 0) return;
    const newActions = [...canvasActions];
    [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
    updateCanvasActions(newActions);
  };

  // 下移操作
  const moveActionDown = (index: number) => {
    if (index === canvasActions.length - 1) return;
    const newActions = [...canvasActions];
    [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
    updateCanvasActions(newActions);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-[var(--muted)]">加载中...</div>;
  }

  return (
    <div className="space-y-8">
      {/* 第一栏：当前启动的操作 */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">
          当前启动的操作
        </h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          画布上显示的操作，最多 4 个，拖拽调整顺序
        </p>

        <div className="space-y-2">
          {canvasActions.map((action, index) => {
            const isBuiltin = action.action_type === 'builtin';
            const builtin = isBuiltin ? BUILTIN_ACTIONS.find(b => b.id === action.action_id) : null;
            const custom = !isBuiltin ? customActions.find(c => c.id === action.action_id) : null;
            const iconName = isBuiltin ? builtin?.icon : (custom?.icon || 'Zap');
            const IconComponent = getIconComponent(iconName || 'Zap');

            return (
              <div
                key={`${action.action_type}-${action.action_id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
              >
                {/* 排序按钮 */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveActionUp(index)}
                    disabled={index === 0}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => moveActionDown(index)}
                    disabled={index === canvasActions.length - 1}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>

                <IconComponent size={18} />
                <span className="flex-1 text-sm text-[var(--fg)]">
                  {isBuiltin ? builtin?.name : custom?.name}
                </span>
                <span className="text-xs text-[var(--muted)] px-2 py-1 rounded bg-[var(--surface-warm-hover)]">
                  {isBuiltin ? t('aiActions.builtin') : t('aiActions.custom')}
                </span>

                {/* 移除按钮 */}
                <Tooltip content="从画布移除">
                  <button
                    onClick={() => removeFromCanvas(action.action_type, action.action_id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </Tooltip>
              </div>
            );
          })}

          {canvasActions.length === 0 && (
            <div className="text-center py-4 text-[var(--muted)] text-sm">
              暂无操作，请从下方添加
            </div>
          )}
        </div>
      </div>

      {/* 第二栏：内置操作 */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">
          内置操作
        </h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          系统内置的操作，不可删除，可添加到画布
        </p>

        <div className="space-y-2">
          {BUILTIN_ACTIONS.map(action => {
            const IconComponent = getIconComponent(action.icon);
            const onCanvas = isOnCanvas('builtin', action.id);
            return (
              <div
                key={action.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
              >
                <IconComponent size={18} />
                <span className="flex-1 text-sm text-[var(--fg)]">
                  {action.name}
                </span>
                <span className="text-xs text-[var(--muted)] px-2 py-1 rounded bg-[var(--surface-warm-hover)]">
                  {t('aiActions.builtin')}
                </span>
                <Tooltip content={onCanvas ? '从画布移除' : '添加到画布'}>
                  <button
                    onClick={() => onCanvas ? removeFromCanvas('builtin', action.id) : addToCanvas('builtin', action.id)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      onCanvas
                        ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
                        : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                    }`}
                  >
                    <Zap size={14} />
                  </button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>

      {/* 第三栏：自定义操作 */}
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
        <p className="text-xs text-[var(--muted)] mb-4">
          用户创建的操作，可编辑、删除、添加到画布
        </p>

        {customActions.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm">
            {t('aiActions.noCustomActions')}
          </div>
        ) : (
          <div className="space-y-2">
            {customActions.map(action => {
              const IconComponent = getIconComponent(action.icon || 'Zap');
              const onCanvas = isOnCanvas('custom', action.id);
              return (
                <div
                  key={action.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
                >
                  <IconComponent size={18} />
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
                    <Tooltip content={onCanvas ? '从画布移除' : '添加到画布'}>
                      <button
                        onClick={() => onCanvas ? removeFromCanvas('custom', action.id) : addToCanvas('custom', action.id)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                          onCanvas
                            ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
                            : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                        }`}
                      >
                        <Zap size={14} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
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
