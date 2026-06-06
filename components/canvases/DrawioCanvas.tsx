'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useLocale } from '@/lib/locales';
import { useMxGraph, type DrawioTool } from '@/hooks/useMxGraph';
import DrawioToolbar from './DrawioToolbar';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import { Copy, ClipboardPaste, Square, Type, Trash2, Pencil } from 'lucide-react';
import type { Cell, CellStyle } from '@maxgraph/core';

interface DrawioCanvasProps {
  code: string;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/** 形状工具到 @maxgraph/core CellStyle 的映射 */
const SHAPE_STYLES: Record<string, CellStyle> = {
  rectangle: { rounded: true, whiteSpace: 'wrap' },
  ellipse: { shape: 'ellipse', whiteSpace: 'wrap' },
  diamond: { shape: 'rhombus', whiteSpace: 'wrap' },
  text: { shape: 'text' },
};

/** 边样式：带箭头 */
const EDGE_STYLE: CellStyle = { endArrow: 'block', endFill: true };

export default function DrawioCanvas({ code }: DrawioCanvasProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  /** 箭头工具：记录第一次点击的源节点 */
  const arrowSourceRef = useRef<Cell | null>(null);

  const {
    graph,
    error,
    activeTool,
    setActiveTool,
    deleteSelected,
    hasSelection,
  } = useMxGraph({ containerRef, code });

  // ── 画布点击：放置形状 / 箭头工具 ──
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!graph) return;
      // 关闭右键菜单
      setMenuState(null);

      // select 工具由 maxgraph 内部处理
      if (activeTool === 'select') return;

      // arrow 工具：点击单元格作为源或目标
      if (activeTool === 'arrow') {
        const target = graph.getCellAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        if (target) {
          if (!arrowSourceRef.current) {
            // 第一次点击：记录源
            arrowSourceRef.current = target;
            graph.setSelectionCell(target);
          } else if (arrowSourceRef.current !== target) {
            // 第二次点击：创建边
            const parent = graph.getDefaultParent();
            const dm = graph.getDataModel();
            dm.beginUpdate();
            try {
              graph.insertEdge(parent, null, '', arrowSourceRef.current, target, EDGE_STYLE);
            } finally {
              dm.endUpdate();
            }
            arrowSourceRef.current = null;
            // 切回 select 工具
            setActiveTool('select');
          }
        } else {
          // 点击空白：取消箭头模式
          arrowSourceRef.current = null;
          setActiveTool('select');
        }
        return;
      }

      // 其他形状工具：在点击位置创建节点
      const style = SHAPE_STYLES[activeTool];
      if (!style) return;

      const scale = graph.getView().getScale();
      const translate = graph.getView().getTranslate();
      const graphX = e.nativeEvent.offsetX / scale - translate.x;
      const graphY = e.nativeEvent.offsetY / scale - translate.y;

      const parent = graph.getDefaultParent();
      const dm = graph.getDataModel();
      dm.beginUpdate();
      try {
        const label = activeTool === 'text' ? 'Text' : '';
        const w = activeTool === 'text' ? 60 : 120;
        const h = activeTool === 'text' ? 30 : 60;
        const cell = graph.insertVertex({
          parent,
          value: label,
          x: graphX,
          y: graphY,
          width: w,
          height: h,
          style,
        });
        graph.setSelectionCell(cell);
        // 文本工具创建后立即进入编辑
        if (activeTool === 'text') {
          graph.startEditingAtCell(cell);
        }
      } finally {
        dm.endUpdate();
      }

      // 创建完成后切回 select
      setActiveTool('select');
    },
    [graph, activeTool, setActiveTool],
  );

  // ── 右键菜单 ──
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!graph) return;

      // 需要动态导入 Clipboard（静态类）
      import('@maxgraph/core').then(({ Clipboard }) => {
        const cell = graph.getCellAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        const scale = graph.getView().getScale();
        const translate = graph.getView().getTranslate();
        const graphX = e.nativeEvent.offsetX / scale - translate.x;
        const graphY = e.nativeEvent.offsetY / scale - translate.y;

        if (cell) {
          // 在元素上右键
          graph.setSelectionCell(cell);
          const items: ContextMenuItem[] = [
            {
              label: t('drawio.action.editLabel'),
              icon: <Pencil size={14} />,
              onClick: () => graph.startEditingAtCell(cell),
            },
            {
              label: t('drawio.action.copy'),
              icon: <Copy size={14} />,
              onClick: () => {
                const cells = graph.getSelectionCells();
                if (cells.length > 0) Clipboard.copy(graph, cells);
              },
            },
            {
              label: t('drawio.action.delete'),
              icon: <Trash2 size={14} />,
              onClick: deleteSelected,
              danger: true,
            },
          ];
          setMenuState({ x: e.clientX, y: e.clientY, items });
        } else {
          // 在空白区域右键
          const items: ContextMenuItem[] = [
            {
              label: t('drawio.action.addRect'),
              icon: <Square size={14} />,
              onClick: () => {
                const parent = graph.getDefaultParent();
                const dm = graph.getDataModel();
                dm.beginUpdate();
                try {
                  graph.insertVertex({
                    parent,
                    value: '',
                    x: graphX,
                    y: graphY,
                    width: 120,
                    height: 60,
                    style: { rounded: true, whiteSpace: 'wrap' },
                  });
                } finally {
                  dm.endUpdate();
                }
              },
            },
            {
              label: t('drawio.action.addText'),
              icon: <Type size={14} />,
              onClick: () => {
                const parent = graph.getDefaultParent();
                const dm = graph.getDataModel();
                dm.beginUpdate();
                try {
                  const cell = graph.insertVertex({
                    parent,
                    value: 'Text',
                    x: graphX,
                    y: graphY,
                    width: 60,
                    height: 30,
                    style: { shape: 'text' },
                  });
                  graph.setSelectionCell(cell);
                  graph.startEditingAtCell(cell);
                } finally {
                  dm.endUpdate();
                }
              },
            },
            {
              label: t('drawio.action.paste'),
              icon: <ClipboardPaste size={14} />,
              onClick: () => {
                Clipboard.paste(graph);
              },
            },
          ];
          setMenuState({ x: e.clientX, y: e.clientY, items });
        }
      });
    },
    [graph, t, deleteSelected],
  );

  // ── 键盘快捷键 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 避免在输入框中触发
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        deleteSelected();
      } else if (e.key === 'Escape') {
        // 取消箭头模式
        arrowSourceRef.current = null;
        setActiveTool('select');
        setMenuState(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, setActiveTool]);

  // ── 错误降级 UI ──
  if (error) {
    return (
      <div className="w-full h-full canvas-grid-bg relative overflow-hidden flex items-center justify-center">
        <div className="max-w-lg w-full mx-4 p-6 rounded-xl bg-[var(--bg-glass)] backdrop-blur-sm border border-red-200/30">
          <p className="text-sm font-medium text-red-500 mb-3">{t('drawio.renderError')}</p>
          <p className="text-xs text-red-400/80 mb-4">{error}</p>
          {/* 降级：显示 XML 源码 */}
          {code && (
            <pre className="text-[11px] text-[var(--muted)] bg-[var(--surface)]/50 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all font-mono">
              {code}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // ── 正常渲染 ──
  return (
    <div className="w-full h-full canvas-grid-bg relative overflow-hidden">
      <DrawioToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onDelete={deleteSelected}
        onEditLabel={() => {
          if (!graph) return;
          const cells = graph.getSelectionCells();
          if (cells.length > 0) graph.startEditingAtCell(cells[0]);
        }}
        hasSelection={hasSelection}
      />

      <div
        ref={containerRef}
        className="w-full h-full"
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
      />

      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={menuState.items}
          onClose={() => setMenuState(null)}
        />
      )}
    </div>
  );
}
