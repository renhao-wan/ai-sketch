'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useLocale } from '@/lib/locales';
import DrawioToolbar from './DrawioToolbar';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import { Copy, ClipboardPaste, Square, Type, Trash2, Pencil } from 'lucide-react';
import type { Cell, CellStyle, Graph, FitPlugin, ModelXmlSerializer } from '@maxgraph/core';

type DrawioTool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow';

interface DrawioCanvasProps {
  code: string;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

const SHAPE_STYLES: Record<string, CellStyle> = {
  rectangle: { rounded: true, fillColor: '#ffffff', strokeColor: '#333333', strokeWidth: 1 },
  ellipse: { shape: 'ellipse', fillColor: '#ffffff', strokeColor: '#333333', strokeWidth: 1 },
  diamond: { shape: 'rhombus', fillColor: '#ffffff', strokeColor: '#333333', strokeWidth: 1 },
  text: { shape: 'text', strokeColor: 'none', fillColor: 'none' },
};

const EDGE_STYLE: CellStyle = {
  endArrow: 'block',
  endFill: true,
  strokeColor: '#333333',
  strokeWidth: 1,
  dashed: false,
};

function loadXml(
  graph: Graph,
  xml: string,
  ModelXmlSerializerClass: any,
  setError: (msg: string | null) => void,
) {
  try {
    let cleanXml = xml.trim();
    const match = cleanXml.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
    if (match) cleanXml = match[0];

    const view = graph.getView();
    const wasRendering = (view as any).rendering;
    (view as any).rendering = false;

    const serializer = new ModelXmlSerializerClass(graph.getDataModel());
    serializer.import(cleanXml);

    const fitPlugin = graph.getPlugin<FitPlugin>('fit');
    if (fitPlugin) {
      fitPlugin.fit();
      fitPlugin.fitCenter();
    }

    (view as any).rendering = wasRendering;
    graph.refresh();
    setError(null);
  } catch (e) {
    try {
      (graph.getView() as any).rendering = true;
      graph.refresh();
    } catch { /* ignore */ }
    setError('XML 解析错误: ' + (e as Error).message);
  }
}

// 修改 maxgraph 默认配置
import('@maxgraph/core').then((maxgraph) => {
  maxgraph.HandleConfig.fillColor = '#4A90D9';
  maxgraph.HandleConfig.strokeColor = '#4A90D9';
  maxgraph.HandleConfig.size = 6;

  maxgraph.VertexHandlerConfig.selectionColor = '#4A90D9';
  maxgraph.VertexHandlerConfig.selectionDashed = true;
  maxgraph.VertexHandlerConfig.selectionStrokeWidth = 1;
  maxgraph.VertexHandlerConfig.rotationEnabled = true;

  maxgraph.EdgeHandlerConfig.selectionColor = '#4A90D9';
  maxgraph.EdgeHandlerConfig.handleShape = 'circle';
  maxgraph.EdgeHandlerConfig.connectFillColor = '#4A90D9';
});

function configureHighlightColors(graph: Graph) {
  const ch = graph.getPlugin<any>('ConnectionHandler');
  if (ch) {
    if (ch.marker) ch.marker.validColor = '#4A90D9';
    if (ch.constraintHandler) ch.constraintHandler.highlightColor = '#4A90D9';
  }
}

export default function DrawioCanvas({ code }: DrawioCanvasProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DrawioTool>('select');
  const activeToolRef = useRef<DrawioTool>('select');
  const [hasSelection, setHasSelection] = useState(false);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const codeRef = useRef(code);
  const drawState = useRef({
    isDrawing: false,
    startX: 0,
    startY: 0,
    previewCell: null as Cell | null,
    arrowSource: null as Cell | null,
    selectionBox: null as HTMLDivElement | null,
  });

  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  // 初始化 mxGraph
  useEffect(() => {
    const container = containerRef.current;
    if (!container || graphRef.current) return;

    let graphInstance: Graph | null = null;
    let destroyed = false;
    let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
    let pointerUpHandler: ((e: PointerEvent) => void) | null = null;

    const init = async () => {
      try {
        const {
          Graph: GraphClass,
          InternalEvent,
          ModelXmlSerializer: ModelXmlSerializerClass,
          getDefaultPlugins,
          Rectangle,
          Point,
        } = await import('@maxgraph/core');

        if (destroyed) return;

        container.querySelectorAll('svg').forEach(svg => svg.remove());

        const plugins = getDefaultPlugins();
        graphInstance = new GraphClass(container, undefined, plugins);

        configureHighlightColors(graphInstance);

        graphInstance.setEnabled(true);
        graphInstance.setCellsSelectable(true);
        graphInstance.setCellsMovable(true);
        graphInstance.setCellsResizable(true);
        graphInstance.setCellsEditable(true);
        graphInstance.setConnectable(true);
        graphInstance.setDropEnabled(false);
        graphInstance.setPanning(true);
        graphInstance.centerZoom = true;

        graphInstance.getSelectionModel().addListener(InternalEvent.CHANGE, () => {
          if (!destroyed) setHasSelection(graphInstance!.getSelectionCells().length > 0);
        });

        // ── 原生事件处理 ──
        const getGraphPoint = (clientX: number, clientY: number) => {
          if (!graphInstance) return null;
          const rect = container.getBoundingClientRect();
          const scale = graphInstance.getView().getScale();
          const translate = graphInstance.getView().getTranslate();
          return {
            x: (clientX - rect.left) / scale - translate.x,
            y: (clientY - rect.top) / scale - translate.y,
          };
        };

        container.addEventListener('pointerdown', (e: PointerEvent) => {
          if (!graphInstance) return;
          const tool = activeToolRef.current;
          const ds = drawState.current;

          // 选择工具：让 maxgraph 处理
          if (tool === 'select') {
            // 记录起始位置用于框选
            ds.startX = e.clientX;
            ds.startY = e.clientY;
            ds.isDrawing = true;
            ds.selectionBox = document.createElement('div');
            ds.selectionBox.style.cssText = `position:fixed;border:2px solid #4A90D9;background:rgba(74,144,217,0.15);pointer-events:none;z-index:10000;left:${e.clientX}px;top:${e.clientY}px;width:0;height:0;`;
            document.body.appendChild(ds.selectionBox);
            return;
          }

          // 非选择工具：处理绘图
          e.stopPropagation();
          ds.isDrawing = true;
          ds.startX = e.clientX;
          ds.startY = e.clientY;

          if (tool === 'arrow') {
            const rect = container.getBoundingClientRect();
            const cell = graphInstance.getCellAt(e.clientX - rect.left, e.clientY - rect.top);
            ds.arrowSource = cell || null;
            const svg = container.querySelector('svg');
            if (svg) {
              let defs = svg.querySelector('defs');
              if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.insertBefore(defs, svg.firstChild!); }
              if (!defs.querySelector('#arrow')) {
                const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                m.id = 'arrow'; m.setAttribute('markerWidth', '8'); m.setAttribute('markerHeight', '6');
                m.setAttribute('refX', '8'); m.setAttribute('refY', '3'); m.setAttribute('orient', 'auto');
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                p.setAttribute('points', '0 0, 8 3, 0 6'); p.setAttribute('fill', '#4A90D9');
                m.appendChild(p); defs.appendChild(m);
              }
              const r = container.getBoundingClientRect();
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', String(e.clientX - r.left)); line.setAttribute('y1', String(e.clientY - r.top));
              line.setAttribute('x2', String(e.clientX - r.left)); line.setAttribute('y2', String(e.clientY - r.top));
              line.setAttribute('stroke', '#4A90D9'); line.setAttribute('stroke-width', '2');
              line.setAttribute('stroke-dasharray', '5,5'); line.setAttribute('marker-end', 'url(#arrow)');
              svg.appendChild(line);
            }
            return;
          }

          // 形状工具：创建预览
          const style = SHAPE_STYLES[tool];
          if (!style) return;
          const pt = getGraphPoint(e.clientX, e.clientY);
          if (!pt) return;
          const parent = graphInstance.getDefaultParent();
          const dm = graphInstance.getDataModel();
          dm.beginUpdate();
          try {
            ds.previewCell = graphInstance.insertVertex({
              parent, value: tool === 'text' ? 'Text' : '',
              x: pt.x, y: pt.y, width: 10, height: 10,
              style: { ...style, opacity: 50, strokeColor: '#4A90D9', strokeWidth: 2, dashed: true },
            });
          } finally { dm.endUpdate(); }
        });

        pointerMoveHandler = (e: PointerEvent) => {
          if (!graphInstance) return;
          const ds = drawState.current;
          if (!ds.isDrawing) return;
          const tool = activeToolRef.current;

          // 选择工具：更新框选框
          if (tool === 'select' && ds.selectionBox) {
            const x = Math.min(ds.startX, e.clientX);
            const y = Math.min(ds.startY, e.clientY);
            ds.selectionBox.style.left = x + 'px';
            ds.selectionBox.style.top = y + 'px';
            ds.selectionBox.style.width = Math.abs(e.clientX - ds.startX) + 'px';
            ds.selectionBox.style.height = Math.abs(e.clientY - ds.startY) + 'px';
            return;
          }

          // 箭头工具：更新预览线
          if (tool === 'arrow') {
            const r = container.getBoundingClientRect();
            const svg = container.querySelector('svg');
            if (svg) {
              const line = svg.querySelector('line[marker-end="url(#arrow)"]') as SVGLineElement;
              if (line) {
                line.setAttribute('x2', String(e.clientX - r.left));
                line.setAttribute('y2', String(e.clientY - r.top));
              }
            }
            return;
          }

          if (!ds.previewCell) return;
          const pt = getGraphPoint(e.clientX, e.clientY);
          const startPt = getGraphPoint(ds.startX, ds.startY);
          if (!pt || !startPt) return;
          const w = Math.abs(pt.x - startPt.x);
          const h = Math.abs(pt.y - startPt.y);
          if (w < 2 && h < 2) return;

          const dm = graphInstance.getDataModel();
          dm.beginUpdate();
          try {
            const geo = ds.previewCell.getGeometry();
            if (geo) {
              const g2 = geo.clone();
              g2.x = Math.min(startPt.x, pt.x);
              g2.y = Math.min(startPt.y, pt.y);
              g2.width = Math.max(w, 1); g2.height = Math.max(h, 1);
              dm.setGeometry(ds.previewCell, g2);
            }
          } finally { dm.endUpdate(); }
        };
        window.addEventListener('pointermove', pointerMoveHandler);

        pointerUpHandler = (e: PointerEvent) => {
          if (!graphInstance) return;
          const ds = drawState.current;
          if (!ds.isDrawing) return;
          ds.isDrawing = false;
          const tool = activeToolRef.current;

          // 选择工具：完成框选
          if (tool === 'select') {
            ds.selectionBox?.remove(); ds.selectionBox = null;
            const scale = graphInstance.getView().getScale();
            const translate = graphInstance.getView().getTranslate();
            const r = container.getBoundingClientRect();
            const x1 = (ds.startX - r.left) / scale - translate.x;
            const y1 = (ds.startY - r.top) / scale - translate.y;
            const x2 = (e.clientX - r.left) / scale - translate.x;
            const y2 = (e.clientY - r.top) / scale - translate.y;
            const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
            const maxX = Math.max(x1, x2), maxY = Math.max(y1, y2);
            if (maxX - minX > 5 && maxY - minY > 5) {
              graphInstance.selectRegion(new Rectangle(minX, minY, maxX - minX, maxY - minY), e);
            }
            return;
          }

          const pt = getGraphPoint(e.clientX, e.clientY);
          const startPt = getGraphPoint(ds.startX, ds.startY);
          if (!pt || !startPt) { ds.previewCell = null; ds.arrowSource = null; return; }
          const w = Math.abs(pt.x - startPt.x);
          const h = Math.abs(pt.y - startPt.y);

          if (tool === 'arrow') {
            // 移除预览线
            const svg = container.querySelector('svg');
            if (svg) {
              const line = svg.querySelector('line[marker-end="url(#arrow)"]') as SVGLineElement;
              if (line) line.remove();
            }

            if (w < 10 && h < 10) { ds.arrowSource = null; return; }
            const r = container.getBoundingClientRect();
            const targetCell = graphInstance.getCellAt(e.clientX - r.left, e.clientY - r.top);
            const parent = graphInstance.getDefaultParent();
            const dm = graphInstance.getDataModel();
            dm.beginUpdate();
            try {
              // 如果起点不在图形上，创建一个透明的临时端点
              let source = ds.arrowSource;
              const tempCells: Cell[] = [];
              if (!source) {
                const startPt = getGraphPoint(ds.startX, ds.startY);
                if (startPt) {
                  source = graphInstance.insertVertex({
                    parent, value: '', x: startPt.x - 1, y: startPt.y - 1,
                    width: 2, height: 2,
                    style: { shape: 'ellipse', fillColor: 'none', strokeColor: 'none' },
                  });
                  tempCells.push(source);
                }
              }

              // 如果终点不在图形上，创建一个透明的临时端点
              let target = targetCell;
              if (!target) {
                const endPt = getGraphPoint(e.clientX, e.clientY);
                if (endPt) {
                  target = graphInstance.insertVertex({
                    parent, value: '', x: endPt.x - 1, y: endPt.y - 1,
                    width: 2, height: 2,
                    style: { shape: 'ellipse', fillColor: 'none', strokeColor: 'none' },
                  });
                  tempCells.push(target);
                }
              }

              // 创建边
              if (source && target) {
                const edge = graphInstance.insertEdge(parent, null, '', source, target, EDGE_STYLE);
                if (edge) {
                  graphInstance.setSelectionCell(edge);

                  // 删除临时端点
                  if (tempCells.length > 0) {
                    // 获取边的几何信息
                    const edgeGeo = edge.getGeometry();
                    const sourceGeo = source.getGeometry();
                    const targetGeo = target.getGeometry();

                    if (edgeGeo && sourceGeo && targetGeo) {
                      // 删除端点和边
                      graphInstance.removeCells([...tempCells, edge]);

                      // 重新创建一个自由浮动的边
                      // 使用绝对坐标
                      const newEdge = graphInstance.insertEdge(parent, null, '', null, null, {
                        ...EDGE_STYLE,
                        edgeStyle: 'none',
                      });

                      // 设置边的绝对坐标
                      if (newEdge) {
                        const newGeo = newEdge.getGeometry();
                        if (newGeo) {
                          newGeo.setTerminalPoint(new Point(sourceGeo.x + sourceGeo.width / 2, sourceGeo.y + sourceGeo.height / 2), true);
                          newGeo.setTerminalPoint(new Point(targetGeo.x + targetGeo.width / 2, targetGeo.y + targetGeo.height / 2), false);
                          dm.setGeometry(newEdge, newGeo);
                        }
                        graphInstance.setSelectionCell(newEdge);
                      }
                    }
                  }
                }
              }
            } finally { dm.endUpdate(); }
            ds.arrowSource = null;
            setTimeout(() => handleSetActiveTool('select'), 50);
            return;
          }

          if (ds.previewCell) {
            const fw = Math.max(w, 60), fh = Math.max(h, 40);
            const dm = graphInstance.getDataModel();
            dm.beginUpdate();
            try {
              const geo = ds.previewCell.getGeometry();
              if (geo) {
                const g2 = geo.clone();
                g2.x = w < 5 ? startPt.x - fw / 2 : Math.min(startPt.x, pt.x);
                g2.y = h < 5 ? startPt.y - fh / 2 : Math.min(startPt.y, pt.y);
                g2.width = fw; g2.height = fh;
                const style = SHAPE_STYLES[tool];
                if (style) graphInstance.setCellStyle(style, [ds.previewCell]);
                dm.setGeometry(ds.previewCell, g2);
              }
              if (tool === 'text') {
                graphInstance.setSelectionCell(ds.previewCell);
                setTimeout(() => graphInstance!.startEditingAtCell(ds.previewCell!), 50);
              }
            } finally { dm.endUpdate(); }
          }
          ds.previewCell = null;
          handleSetActiveTool('select');
        };
        window.addEventListener('pointerup', pointerUpHandler);

        graphRef.current = graphInstance;
        if (!destroyed) setGraph(graphInstance);

        const xml = codeRef.current;
        if (xml) loadXml(graphInstance, xml, ModelXmlSerializerClass, (msg) => { if (!destroyed) setError(msg); });
      } catch (e) {
        if (!destroyed) setError('加载 @maxgraph/core 失败: ' + (e as Error).message);
      }
    };
    init();

    return () => {
      destroyed = true;
      if (pointerMoveHandler) window.removeEventListener('pointermove', pointerMoveHandler);
      if (pointerUpHandler) window.removeEventListener('pointerup', pointerUpHandler);
      if (graphInstance) { graphInstance.destroy(); graphRef.current = null; }
      container.querySelectorAll('svg').forEach(svg => svg.remove());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!code) { const g = graphRef.current; if (g) { g.getDataModel().clear(); setError(null); } return; }
    const g = graphRef.current;
    if (!g) return;
    import('@maxgraph/core').then(({ ModelXmlSerializer: M }) => {
      if (graphRef.current) loadXml(g, code, M, (msg) => setError(msg));
    });
  }, [code]);

  const deleteSelected = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const cells = g.getSelectionCells();
    if (cells.length > 0) g.removeCells(cells);
  }, []);

  const handleSetActiveTool = useCallback((tool: DrawioTool) => {
    setActiveTool(tool);
    activeToolRef.current = tool;
    const g = graphRef.current;
    if (!g) return;
    if (tool === 'select') {
      g.setEnabled(true);
      if (containerRef.current) containerRef.current.style.cursor = 'default';
    } else {
      g.setEnabled(false);
      if (containerRef.current) containerRef.current.style.cursor = 'crosshair';
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const g = graphRef.current;
      if (!g) return;

      import('@maxgraph/core').then(({ Clipboard }) => {
        const cell = g.getCellAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        const scale = g.getView().getScale();
        const translate = g.getView().getTranslate();
        const graphX = e.nativeEvent.offsetX / scale - translate.x;
        const graphY = e.nativeEvent.offsetY / scale - translate.y;

        if (cell) {
          g.setSelectionCell(cell);
          setMenuState({
            x: e.clientX, y: e.clientY,
            items: [
              { label: t('drawio.action.editLabel'), icon: <Pencil size={14} />, onClick: () => g.startEditingAtCell(cell) },
              { label: t('drawio.action.copy'), icon: <Copy size={14} />, onClick: () => { const c = g.getSelectionCells(); if (c.length > 0) Clipboard.copy(g, c); } },
              { label: t('drawio.action.delete'), icon: <Trash2 size={14} />, onClick: deleteSelected, danger: true },
            ],
          });
        } else {
          setMenuState({
            x: e.clientX, y: e.clientY,
            items: [
              { label: t('drawio.action.addRect'), icon: <Square size={14} />, onClick: () => { const p = g.getDefaultParent(); const dm = g.getDataModel(); dm.beginUpdate(); try { g.insertVertex({ parent: p, value: '', x: graphX, y: graphY, width: 120, height: 60, style: SHAPE_STYLES.rectangle }); } finally { dm.endUpdate(); } } },
              { label: t('drawio.action.addText'), icon: <Type size={14} />, onClick: () => { const p = g.getDefaultParent(); const dm = g.getDataModel(); dm.beginUpdate(); try { const c = g.insertVertex({ parent: p, value: 'Text', x: graphX, y: graphY, width: 60, height: 30, style: SHAPE_STYLES.text }); g.setSelectionCell(c); g.startEditingAtCell(c); } finally { dm.endUpdate(); } } },
              { label: t('drawio.action.paste'), icon: <ClipboardPaste size={14} />, onClick: () => Clipboard.paste(g) },
            ],
          });
        }
      });
    },
    [t, deleteSelected],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        deleteSelected();
      } else if (e.key === 'Escape') {
        const ds = drawState.current;
        ds.isDrawing = false; ds.selectionBox?.remove(); ds.selectionBox = null;
        if (ds.previewCell && graphRef.current) { graphRef.current.removeCells([ds.previewCell]); ds.previewCell = null; }
        ds.arrowSource = null;
        setActiveTool('select'); activeToolRef.current = 'select'; setMenuState(null);
        if (graphRef.current) graphRef.current.setEnabled(true);
        if (containerRef.current) containerRef.current.style.cursor = 'default';
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);

  if (error) {
    return (
      <div className="w-full h-full canvas-grid-bg relative overflow-hidden flex items-center justify-center">
        <div className="max-w-lg w-full mx-4 p-6 rounded-xl bg-[var(--bg-glass)] backdrop-blur-sm border border-red-200/30">
          <p className="text-sm font-medium text-red-500 mb-3">{t('drawio.renderError')}</p>
          <p className="text-xs text-red-400/80 mb-4">{error}</p>
          {code && <pre className="text-[11px] text-[var(--muted)] bg-[var(--surface)]/50 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all font-mono">{code}</pre>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full canvas-grid-bg relative overflow-hidden">
      <DrawioToolbar
        activeTool={activeTool}
        onToolChange={handleSetActiveTool}
        onDelete={deleteSelected}
        onEditLabel={() => { const g = graphRef.current; if (!g) return; const c = g.getSelectionCells(); if (c.length > 0) g.startEditingAtCell(c[0]); }}
        hasSelection={hasSelection}
      />
      <div ref={containerRef} className="w-full h-full" onContextMenu={handleContextMenu} />
      {menuState && <ContextMenu x={menuState.x} y={menuState.y} items={menuState.items} onClose={() => setMenuState(null)} />}
    </div>
  );
}
