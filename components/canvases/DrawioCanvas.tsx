'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useLocale } from '@/lib/locales';
import { svgToPng } from '@/lib/utils/export-diagram';
import DrawioToolbar from './DrawioToolbar';
import ZoomToolbar from './ZoomToolbar';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import { Copy, ClipboardPaste, Square, Type, Trash2, Pencil } from 'lucide-react';
import type { Cell, CellStyle, Graph, FitPlugin, ModelXmlSerializer } from '@maxgraph/core';
import type { CanvasExportHandle } from './DiagramCanvas';

// ── 类型定义 ──
type DrawioTool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow';

interface DrawioCanvasProps {
  code: string;
  exportRef?: React.MutableRefObject<CanvasExportHandle | null>;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

// ── 常量定义 ──
const DRAW_CONSTANTS = {
  /** 箭头端点透明顶点尺寸 */
  ARROW_ENDPOINT_SIZE: 2,
  /** 框选最小距离阈值（像素） */
  MIN_SELECTION_DISTANCE: 5,
  /** 框选框 z-index */
  SELECTION_BOX_Z_INDEX: 10000,
  /** 默认形状宽度 */
  DEFAULT_SHAPE_WIDTH: 120,
  /** 默认形状高度 */
  DEFAULT_SHAPE_HEIGHT: 60,
  /** 最小拖拽尺寸 */
  MIN_DRAG_SIZE: 2,
  /** 最小箭头长度 */
  MIN_ARROW_LENGTH: 10,
  /** 文本框默认尺寸 */
  TEXT_WIDTH: 60,
  TEXT_HEIGHT: 30,
  /** 缩放相关常量 */
  MIN_SCALE: 0.1,
  MAX_SCALE: 5,
  ZOOM_STEP: 0.1,
  ZOOM_WHEEL_STEP: 0.05,
} as const;

/** 主题颜色 - 与 CSS 变量 --primary 保持一致 */
const THEME_COLORS = {
  PRIMARY: '#4A90D9',
  PRIMARY_LIGHT: 'rgba(74, 144, 217, 0.15)',
  TEXT: '#333333',
  WHITE: '#ffffff',
} as const;

// ── 样式定义 ──
const SHAPE_STYLES: Record<string, CellStyle> = {
  rectangle: {
    rounded: true,
    fillColor: THEME_COLORS.WHITE,
    strokeColor: THEME_COLORS.TEXT,
    strokeWidth: 1,
  },
  ellipse: {
    shape: 'ellipse',
    fillColor: THEME_COLORS.WHITE,
    strokeColor: THEME_COLORS.TEXT,
    strokeWidth: 1,
  },
  diamond: {
    shape: 'rhombus',
    fillColor: THEME_COLORS.WHITE,
    strokeColor: THEME_COLORS.TEXT,
    strokeWidth: 1,
  },
  text: {
    shape: 'text',
    strokeColor: 'none',
    fillColor: 'none',
  },
};

const EDGE_STYLE: CellStyle = {
  endArrow: 'block',
  endFill: true,
  strokeColor: THEME_COLORS.TEXT,
  strokeWidth: 1,
  dashed: false,
};

/** 预览样式 - 拖拽时的临时样式 */
const PREVIEW_STYLE: Partial<CellStyle> = {
  opacity: 50,
  strokeColor: THEME_COLORS.PRIMARY,
  strokeWidth: 2,
  dashed: true,
};

// ── 工具函数 ──

/**
 * 加载 Draw.io XML 到画布
 */
function loadXml(
  graph: Graph,
  xml: string,
  ModelXmlSerializerClass: typeof ModelXmlSerializer,
  setError: (msg: string | null) => void,
): void {
  try {
    let cleanXml = xml.trim();
    const match = cleanXml.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
    if (match) cleanXml = match[0];

    const view = graph.getView();
    const wasRendering = (view as any).rendering;
    (view as any).rendering = false;

    const serializer = new ModelXmlSerializerClass(graph.getDataModel());
    serializer.import(cleanXml);

    // 自适应画布
    const fitPlugin = graph.getPlugin<FitPlugin>('fit');
    if (fitPlugin) {
      fitPlugin.fit();
      fitPlugin.fitCenter();
    }

    (view as any).rendering = wasRendering;
    graph.refresh();
    setError(null);
  } catch (e) {
    // 恢复渲染状态
    try {
      (graph.getView() as any).rendering = true;
      graph.refresh();
    } catch { /* 忽略恢复错误 */ }
    setError('XML 解析错误: ' + (e as Error).message);
  }
}

/**
 * 配置 maxgraph 全局样式
 * 注意：这些是全局配置，会影响所有 maxgraph 实例
 */
function configureMaxgraphStyles(): void {
  import('@maxgraph/core').then((maxgraph) => {
    // 选中手柄样式 - 蓝色圆点
    maxgraph.HandleConfig.fillColor = THEME_COLORS.PRIMARY;
    maxgraph.HandleConfig.strokeColor = THEME_COLORS.PRIMARY;
    maxgraph.HandleConfig.size = 6;

    // 顶点选中样式
    maxgraph.VertexHandlerConfig.selectionColor = THEME_COLORS.PRIMARY;
    maxgraph.VertexHandlerConfig.selectionDashed = true;
    maxgraph.VertexHandlerConfig.selectionStrokeWidth = 1;
    maxgraph.VertexHandlerConfig.rotationEnabled = true;

    // 边选中样式
    maxgraph.EdgeHandlerConfig.selectionColor = THEME_COLORS.PRIMARY;
    maxgraph.EdgeHandlerConfig.handleShape = 'circle';
    maxgraph.EdgeHandlerConfig.connectFillColor = THEME_COLORS.PRIMARY;
  });
}

/**
 * 配置画布实例的高亮颜色
 */
function configureHighlightColors(graph: Graph): void {
  const ch = graph.getPlugin<any>('ConnectionHandler');
  if (ch) {
    if (ch.marker) ch.marker.validColor = THEME_COLORS.PRIMARY;
    if (ch.constraintHandler) ch.constraintHandler.highlightColor = THEME_COLORS.PRIMARY;
  }
}

// 初始化全局样式（仅执行一次）
configureMaxgraphStyles();

// ── 主组件 ──

export default function DrawioCanvas({ code, exportRef }: DrawioCanvasProps) {
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
  const [scale, setScale] = useState(1);

  // 绘图状态 - 统一管理所有拖拽相关状态
  const drawState = useRef({
    isDrawing: false,
    startX: 0,
    startY: 0,
    previewCell: null as Cell | null,
    arrowSource: null as Cell | null,
    selectionBox: null as HTMLDivElement | null,
  });

  // 同步 ref 和 state
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  // ── 初始化 Graph ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container || graphRef.current) return;

    let graphInstance: Graph | null = null;
    let destroyed = false;
    let resizeObserver: ResizeObserver | null = null;

    // 保存事件监听器引用，用于清理
    const eventListeners: Array<{
      target: EventTarget;
      type: string;
      handler: EventListenerOrEventListenerObject;
      options?: boolean | AddEventListenerOptions;
    }> = [];

    /**
     * 添加事件监听器并保存引用
     */
    const addTrackedEventListener = (
      target: EventTarget,
      type: string,
      handler: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler, options);
      eventListeners.push({ target, type, handler, options });
    };

    /**
     * 移除所有已注册的事件监听器
     */
    const removeAllEventListeners = () => {
      eventListeners.forEach(({ target, type, handler, options }) => {
        target.removeEventListener(type, handler, options);
      });
      eventListeners.length = 0;
    };

    /**
     * 清理绘图状态
     */
    const cleanupDrawState = () => {
      const ds = drawState.current;
      ds.isDrawing = false;

      // 移除框选框
      if (ds.selectionBox) {
        ds.selectionBox.remove();
        ds.selectionBox = null;
      }

      // 移除预览单元
      if (ds.previewCell && graphInstance) {
        graphInstance.removeCells([ds.previewCell]);
        ds.previewCell = null;
      }

      // 移除箭头预览线
      if (container) {
        const svg = container.querySelector('svg');
        if (svg) {
          const previewLine = svg.querySelector('line[marker-end="url(#arrow)"]');
          if (previewLine) previewLine.remove();
        }
      }

      ds.arrowSource = null;
    };

    /**
     * 等待容器获得有效尺寸
     */
    const waitForContainerSize = (): Promise<void> => {
      return new Promise((resolve) => {
        const checkSize = () => {
          const rect = container.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        if (checkSize()) {
          resolve();
          return;
        }

        // 使用 ResizeObserver 监听尺寸变化
        resizeObserver = new ResizeObserver(() => {
          if (checkSize()) {
            resizeObserver?.disconnect();
            resizeObserver = null;
            resolve();
          }
        });
        resizeObserver.observe(container);
      });
    };

    /**
     * 初始化画布
     */
    const init = async () => {
      try {
        // 等待容器获得有效尺寸
        await waitForContainerSize();

        if (destroyed) return;

        const {
          Graph: GraphClass,
          InternalEvent,
          ModelXmlSerializer: ModelXmlSerializerClass,
          getDefaultPlugins,
          Rectangle,
          Point,
        } = await import('@maxgraph/core');

        if (destroyed) return;

        // 清除现有的 SVG 元素
        container.querySelectorAll('svg').forEach(svg => svg.remove());

        // 创建画布实例
        const plugins = getDefaultPlugins();
        graphInstance = new GraphClass(container, undefined, plugins);

        // 配置高亮颜色
        configureHighlightColors(graphInstance);

        // 配置画布属性
        graphInstance.setEnabled(true);
        graphInstance.setCellsSelectable(true);
        graphInstance.setCellsMovable(true);
        graphInstance.setCellsResizable(true);
        graphInstance.setCellsEditable(true);
        graphInstance.setConnectable(true);
        graphInstance.setDropEnabled(false);
        graphInstance.setPanning(true);
        graphInstance.centerZoom = true;

        // 监听选中变化
        graphInstance.getSelectionModel().addListener(InternalEvent.CHANGE, () => {
          if (!destroyed) {
            setHasSelection(graphInstance!.getSelectionCells().length > 0);
          }
        });

        // ── 坐标转换工具 ──
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

        // ── pointerdown 事件处理 ──
        addTrackedEventListener(container, 'pointerdown', ((e: PointerEvent) => {
          if (!graphInstance) return;
          const tool = activeToolRef.current;
          const ds = drawState.current;

          // 选择工具：开始框选
          if (tool === 'select') {
            ds.startX = e.clientX;
            ds.startY = e.clientY;
            ds.isDrawing = true;

            // 创建框选框
            const selectionBox = document.createElement('div');
            selectionBox.style.cssText = `
              position: fixed;
              border: 2px solid ${THEME_COLORS.PRIMARY};
              background: ${THEME_COLORS.PRIMARY_LIGHT};
              pointer-events: none;
              z-index: ${DRAW_CONSTANTS.SELECTION_BOX_Z_INDEX};
              left: ${e.clientX}px;
              top: ${e.clientY}px;
              width: 0;
              height: 0;
            `;
            document.body.appendChild(selectionBox);
            ds.selectionBox = selectionBox;
            return;
          }

          // 非选择工具：阻止 maxgraph 处理
          e.stopPropagation();
          ds.isDrawing = true;
          ds.startX = e.clientX;
          ds.startY = e.clientY;

          // 箭头工具：记录起点
          if (tool === 'arrow') {
            const rect = container.getBoundingClientRect();
            const cell = graphInstance.getCellAt(e.clientX - rect.left, e.clientY - rect.top);
            ds.arrowSource = cell || null;

            // 创建预览线
            const svg = container.querySelector('svg');
            if (svg) {
              // 确保箭头标记存在
              let defs = svg.querySelector('defs');
              if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                svg.insertBefore(defs, svg.firstChild!);
              }
              if (!defs.querySelector('#arrow')) {
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.id = 'arrow';
                marker.setAttribute('markerWidth', '8');
                marker.setAttribute('markerHeight', '6');
                marker.setAttribute('refX', '8');
                marker.setAttribute('refY', '3');
                marker.setAttribute('orient', 'auto');
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', '0 0, 8 3, 0 6');
                polygon.setAttribute('fill', THEME_COLORS.PRIMARY);
                marker.appendChild(polygon);
                defs.appendChild(marker);
              }

              // 创建预览线
              const r = container.getBoundingClientRect();
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', String(e.clientX - r.left));
              line.setAttribute('y1', String(e.clientY - r.top));
              line.setAttribute('x2', String(e.clientX - r.left));
              line.setAttribute('y2', String(e.clientY - r.top));
              line.setAttribute('stroke', THEME_COLORS.PRIMARY);
              line.setAttribute('stroke-width', '2');
              line.setAttribute('stroke-dasharray', '5,5');
              line.setAttribute('marker-end', 'url(#arrow)');
              svg.appendChild(line);
            }
            return;
          }

          // 形状工具：创建预览单元
          const style = SHAPE_STYLES[tool];
          if (!style) return;
          const pt = getGraphPoint(e.clientX, e.clientY);
          if (!pt) return;

          const parent = graphInstance.getDefaultParent();
          const dm = graphInstance.getDataModel();
          dm.beginUpdate();
          try {
            ds.previewCell = graphInstance.insertVertex({
              parent,
              value: tool === 'text' ? 'Text' : '',
              x: pt.x,
              y: pt.y,
              width: DRAW_CONSTANTS.MIN_DRAG_SIZE,
              height: DRAW_CONSTANTS.MIN_DRAG_SIZE,
              style: { ...style, ...PREVIEW_STYLE },
            });
          } finally {
            dm.endUpdate();
          }
        }) as EventListener);

        // ── pointermove 事件处理 ──
        addTrackedEventListener(window, 'pointermove', ((e: PointerEvent) => {
          if (!graphInstance) return;
          const ds = drawState.current;
          if (!ds.isDrawing) return;
          const tool = activeToolRef.current;

          // 选择工具：更新框选框
          if (tool === 'select' && ds.selectionBox) {
            const x = Math.min(ds.startX, e.clientX);
            const y = Math.min(ds.startY, e.clientY);
            ds.selectionBox.style.left = `${x}px`;
            ds.selectionBox.style.top = `${y}px`;
            ds.selectionBox.style.width = `${Math.abs(e.clientX - ds.startX)}px`;
            ds.selectionBox.style.height = `${Math.abs(e.clientY - ds.startY)}px`;
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

          // 形状工具：更新预览单元尺寸
          if (!ds.previewCell) return;
          const pt = getGraphPoint(e.clientX, e.clientY);
          const startPt = getGraphPoint(ds.startX, ds.startY);
          if (!pt || !startPt) return;

          const w = Math.abs(pt.x - startPt.x);
          const h = Math.abs(pt.y - startPt.y);
          if (w < DRAW_CONSTANTS.MIN_DRAG_SIZE && h < DRAW_CONSTANTS.MIN_DRAG_SIZE) return;

          const dm = graphInstance.getDataModel();
          dm.beginUpdate();
          try {
            const geo = ds.previewCell.getGeometry();
            if (geo) {
              const clonedGeo = geo.clone();
              clonedGeo.x = Math.min(startPt.x, pt.x);
              clonedGeo.y = Math.min(startPt.y, pt.y);
              clonedGeo.width = Math.max(w, 1);
              clonedGeo.height = Math.max(h, 1);
              dm.setGeometry(ds.previewCell, clonedGeo);
            }
          } finally {
            dm.endUpdate();
          }
        }) as EventListener);

        // ── pointerup 事件处理 ──
        addTrackedEventListener(window, 'pointerup', ((e: PointerEvent) => {
          if (!graphInstance) return;
          const ds = drawState.current;
          if (!ds.isDrawing) return;
          ds.isDrawing = false;
          const tool = activeToolRef.current;

          // 选择工具：完成框选
          if (tool === 'select') {
            // 移除框选框
            ds.selectionBox?.remove();
            ds.selectionBox = null;

            // 计算框选区域（图形坐标）
            const scale = graphInstance.getView().getScale();
            const translate = graphInstance.getView().getTranslate();
            const r = container.getBoundingClientRect();
            const x1 = (ds.startX - r.left) / scale - translate.x;
            const y1 = (ds.startY - r.top) / scale - translate.y;
            const x2 = (e.clientX - r.left) / scale - translate.x;
            const y2 = (e.clientY - r.top) / scale - translate.y;
            const minX = Math.min(x1, x2);
            const minY = Math.min(y1, y2);
            const maxX = Math.max(x1, x2);
            const maxY = Math.max(y1, y2);

            // 只有超过最小距离才执行框选
            if (maxX - minX > DRAW_CONSTANTS.MIN_SELECTION_DISTANCE &&
                maxY - minY > DRAW_CONSTANTS.MIN_SELECTION_DISTANCE) {
              graphInstance.selectRegion(
                new Rectangle(minX, minY, maxX - minX, maxY - minY),
                e,
              );
            }
            return;
          }

          // 获取坐标点
          const pt = getGraphPoint(e.clientX, e.clientY);
          const startPt = getGraphPoint(ds.startX, ds.startY);
          if (!pt || !startPt) {
            ds.previewCell = null;
            ds.arrowSource = null;
            return;
          }

          const w = Math.abs(pt.x - startPt.x);
          const h = Math.abs(pt.y - startPt.y);

          // 箭头工具：创建箭头边
          if (tool === 'arrow') {
            // 移除预览线
            const svg = container.querySelector('svg');
            if (svg) {
              const line = svg.querySelector('line[marker-end="url(#arrow)"]') as SVGLineElement;
              if (line) line.remove();
            }

            // 检查最小长度
            if (w < DRAW_CONSTANTS.MIN_ARROW_LENGTH && h < DRAW_CONSTANTS.MIN_ARROW_LENGTH) {
              ds.arrowSource = null;
              return;
            }

            const parent = graphInstance.getDefaultParent();
            const dm = graphInstance.getDataModel();
            dm.beginUpdate();
            try {
              // 创建自由浮动的边（不依赖端点顶点）
              const edge = graphInstance.insertEdge({
                parent,
                value: '',
                source: null,
                target: null,
                style: {
                  ...EDGE_STYLE,
                  edgeStyle: 'none',
                },
              });

              if (edge) {
                const geo = edge.getGeometry();
                if (geo) {
                  // 设置绝对起点
                  const sourcePt = getGraphPoint(ds.startX, ds.startY);
                  if (sourcePt) {
                    geo.setTerminalPoint(new Point(sourcePt.x, sourcePt.y), true);
                  }
                  // 设置绝对终点
                  geo.setTerminalPoint(new Point(pt.x, pt.y), false);
                  dm.setGeometry(edge, geo);
                }
                graphInstance.setSelectionCell(edge);
              }
            } finally {
              dm.endUpdate();
            }

            ds.arrowSource = null;
            setTimeout(() => handleSetActiveTool('select'), 50);
            return;
          }

          // 形状工具：完成形状创建
          if (ds.previewCell) {
            const finalW = Math.max(w, DRAW_CONSTANTS.DEFAULT_SHAPE_WIDTH / 2);
            const finalH = Math.max(h, DRAW_CONSTANTS.DEFAULT_SHAPE_HEIGHT / 2);

            const dm = graphInstance.getDataModel();
            dm.beginUpdate();
            try {
              const geo = ds.previewCell.getGeometry();
              if (geo) {
                const clonedGeo = geo.clone();
                // 如果拖拽距离很小，居中放置
                clonedGeo.x = w < DRAW_CONSTANTS.MIN_SELECTION_DISTANCE
                  ? startPt.x - finalW / 2
                  : Math.min(startPt.x, pt.x);
                clonedGeo.y = h < DRAW_CONSTANTS.MIN_SELECTION_DISTANCE
                  ? startPt.y - finalH / 2
                  : Math.min(startPt.y, pt.y);
                clonedGeo.width = finalW;
                clonedGeo.height = finalH;

                // 应用最终样式
                const style = SHAPE_STYLES[tool];
                if (style) {
                  graphInstance.setCellStyle(style, [ds.previewCell]);
                }
                dm.setGeometry(ds.previewCell, clonedGeo);
              }

              // 文本框自动进入编辑模式
              if (tool === 'text') {
                graphInstance.setSelectionCell(ds.previewCell);
                setTimeout(() => {
                  graphInstance!.startEditingAtCell(ds.previewCell!);
                }, 50);
              }
            } finally {
              dm.endUpdate();
            }
          }

          ds.previewCell = null;
          handleSetActiveTool('select');
        }) as EventListener);

        // ── 鼠标滚轮缩放 ──
        addTrackedEventListener(container, 'wheel', ((e: WheelEvent) => {
          e.preventDefault();
          if (!graphInstance) return;

          const currentScale = graphInstance.getView().getScale();
          const delta = e.deltaY > 0 ? -DRAW_CONSTANTS.ZOOM_WHEEL_STEP : DRAW_CONSTANTS.ZOOM_WHEEL_STEP;
          const newScale = Math.max(
            DRAW_CONSTANTS.MIN_SCALE,
            Math.min(DRAW_CONSTANTS.MAX_SCALE, currentScale + delta)
          );

          // 以鼠标位置为中心缩放
          const view = graphInstance.getView();
          const rect = container.getBoundingClientRect();
          const canvasX = e.clientX - rect.left;
          const canvasY = e.clientY - rect.top;

          // 计算缩放前的图形坐标
          const graphX = canvasX / currentScale - view.getTranslate().x;
          const graphY = canvasY / currentScale - view.getTranslate().y;

          // 设置新缩放比例
          view.setScale(newScale);

          // 调整平移以保持鼠标位置不变
          const newTranslateX = canvasX / newScale - graphX;
          const newTranslateY = canvasY / newScale - graphY;
          view.setTranslate(newTranslateX, newTranslateY);

          // 更新缩放状态
          if (!destroyed) setScale(newScale);
        }) as EventListener);

        // 保存画布实例引用
        graphRef.current = graphInstance;
        if (!destroyed) setGraph(graphInstance);

        // 加载 XML 内容
        const xml = codeRef.current;
        if (xml) {
          loadXml(graphInstance, xml, ModelXmlSerializerClass, (msg) => {
            if (!destroyed) setError(msg);
          });
        }
      } catch (e) {
        if (!destroyed) {
          setError('加载 @maxgraph/core 失败: ' + (e as Error).message);
        }
      }
    };

    init();

    // ── 清理函数 ──
    return () => {
      destroyed = true;

      // 停止 ResizeObserver
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      // 清理绘图状态（移除框选框、预览单元等）
      cleanupDrawState();

      // 移除所有事件监听器
      removeAllEventListeners();

      // 销毁画布实例
      if (graphInstance) {
        graphInstance.destroy();
        graphRef.current = null;
      }

      // 清除 SVG 元素
      container.querySelectorAll('svg').forEach(svg => svg.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 代码变化时重新加载 ──
  useEffect(() => {
    if (!code) {
      const g = graphRef.current;
      if (g) {
        g.getDataModel().clear();
        setError(null);
      }
      return;
    }

    const g = graphRef.current;
    if (!g) return;

    import('@maxgraph/core').then(({ ModelXmlSerializer: M }) => {
      if (graphRef.current) {
        loadXml(g, code, M, (msg) => setError(msg));
      }
    });
  }, [code]);

  // 注册导出函数（依赖 graph state，确保 graph 初始化完成）
  useEffect(() => {
    if (!exportRef || !graph) return;
    const container = containerRef.current;
    if (!container) return;

    exportRef.current = {
      exportAs: async (format) => {
        // maxgraph 使用 SVG 渲染，需要正确获取 SVG 元素
        const svgEl = container.querySelector('svg');
        if (!svgEl) throw new Error('图表未渲染');

        // 获取画布容器尺寸
        const containerRect = container.getBoundingClientRect();
        const width = containerRect.width || 800;
        const height = containerRect.height || 600;

        // 克隆 SVG
        const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;

        // 确保 SVG 有正确的命名空间
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        // 设置 SVG 尺寸
        clonedSvg.setAttribute('width', String(width));
        clonedSvg.setAttribute('height', String(height));

        // 设置 viewBox
        if (!clonedSvg.getAttribute('viewBox')) {
          const bounds = graph.getGraphBounds();
          const scale = graph.getView().getScale();
          clonedSvg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width / scale} ${bounds.height / scale}`);
        }

        // 清理可能导致跨域问题的内容
        // 1. 清理 style 元素中的 @import 语句（保留其他样式）
        clonedSvg.querySelectorAll('style').forEach(s => {
          if (s.textContent) {
            s.textContent = s.textContent.replace(/@import[^;]+;/g, '');
          }
        });
        // 2. 移除所有 image 元素（可能引用外部资源）
        clonedSvg.querySelectorAll('image').forEach(img => img.remove());
        // 3. 移除所有 use 元素（可能引用外部资源）
        clonedSvg.querySelectorAll('use').forEach(use => use.remove());
        // 4. 移除外部链接引用
        clonedSvg.querySelectorAll('*').forEach(el => {
          const href = el.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('data:')) {
            el.removeAttribute('href');
          }
          const xlinkHref = el.getAttribute('xlink:href');
          if (xlinkHref && !xlinkHref.startsWith('#') && !xlinkHref.startsWith('data:')) {
            el.removeAttribute('xlink:href');
          }
          // 移除所有 on* 事件属性
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) {
              el.removeAttribute(attr.name);
            }
          });
        });

        const svgString = new XMLSerializer().serializeToString(clonedSvg);

        if (format === 'svg') {
          return new Blob([svgString], { type: 'image/svg+xml' });
        }

        // PNG - 使用 Canvas API 直接绘制
        return new Promise<Blob>((resolve, reject) => {
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('无法创建 Canvas 上下文'));

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);

          const img = new Image();
          img.crossOrigin = 'anonymous';

          img.onload = () => {
            try {
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob(
                (blob) => {
                  if (blob) resolve(blob);
                  else reject(new Error('Canvas 转换失败'));
                },
                'image/png'
              );
            } catch (e) {
              reject(new Error('Canvas 导出失败: ' + (e as Error).message));
            }
          };

          img.onerror = () => {
            reject(new Error('SVG 图片加载失败'));
          };

          const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          img.src = URL.createObjectURL(blob);
        });
      },
    };

    return () => { exportRef.current = null; };
  }, [graph, exportRef]);

  // ── 删除选中单元 ──
  const deleteSelected = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const cells = g.getSelectionCells();
    if (cells.length > 0) {
      g.removeCells(cells);
    }
  }, []);

  // ── 缩放功能 ──
  const handleZoomIn = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const newScale = Math.min(g.getView().getScale() + DRAW_CONSTANTS.ZOOM_STEP, DRAW_CONSTANTS.MAX_SCALE);
    g.getView().setScale(newScale);
    setScale(newScale);
  }, []);

  const handleZoomOut = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const newScale = Math.max(g.getView().getScale() - DRAW_CONSTANTS.ZOOM_STEP, DRAW_CONSTANTS.MIN_SCALE);
    g.getView().setScale(newScale);
    setScale(newScale);
  }, []);

  const handleFitToView = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const fitPlugin = g.getPlugin<FitPlugin>('fit');
    if (fitPlugin) {
      fitPlugin.fit();
      fitPlugin.fitCenter();
      setScale(g.getView().getScale());
    }
  }, []);

  const handleZoomToPoint = useCallback((pointX: number, pointY: number, newScale: number) => {
    const g = graphRef.current;
    if (!g) return;
    const view = g.getView();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const canvasX = pointX - rect.left;
    const canvasY = pointY - rect.top;

    // 计算缩放前的图形坐标
    const graphX = canvasX / view.getScale() - view.getTranslate().x;
    const graphY = canvasY / view.getScale() - view.getTranslate().y;

    // 设置新缩放比例
    view.setScale(newScale);

    // 调整平移以保持鼠标位置不变
    const newTranslateX = canvasX / newScale - graphX;
    const newTranslateY = canvasY / newScale - graphY;
    view.setTranslate(newTranslateX, newTranslateY);

    setScale(newScale);
  }, []);

  // ── 切换工具 ──
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

  // ── 右键菜单 ──
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
          // 在单元上右键
          g.setSelectionCell(cell);
          setMenuState({
            x: e.clientX,
            y: e.clientY,
            items: [
              {
                label: t('drawio.action.editLabel'),
                icon: <Pencil size={14} />,
                onClick: () => g.startEditingAtCell(cell),
              },
              {
                label: t('drawio.action.copy'),
                icon: <Copy size={14} />,
                onClick: () => {
                  const cells = g.getSelectionCells();
                  if (cells.length > 0) Clipboard.copy(g, cells);
                },
              },
              {
                label: t('drawio.action.delete'),
                icon: <Trash2 size={14} />,
                onClick: deleteSelected,
                danger: true,
              },
            ],
          });
        } else {
          // 在空白处右键
          setMenuState({
            x: e.clientX,
            y: e.clientY,
            items: [
              {
                label: t('drawio.action.addRect'),
                icon: <Square size={14} />,
                onClick: () => {
                  const parent = g.getDefaultParent();
                  const dm = g.getDataModel();
                  dm.beginUpdate();
                  try {
                    g.insertVertex({
                      parent,
                      value: '',
                      x: graphX,
                      y: graphY,
                      width: DRAW_CONSTANTS.DEFAULT_SHAPE_WIDTH,
                      height: DRAW_CONSTANTS.DEFAULT_SHAPE_HEIGHT,
                      style: SHAPE_STYLES.rectangle,
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
                  const parent = g.getDefaultParent();
                  const dm = g.getDataModel();
                  dm.beginUpdate();
                  try {
                    const cell = g.insertVertex({
                      parent,
                      value: 'Text',
                      x: graphX,
                      y: graphY,
                      width: DRAW_CONSTANTS.TEXT_WIDTH,
                      height: DRAW_CONSTANTS.TEXT_HEIGHT,
                      style: SHAPE_STYLES.text,
                    });
                    g.setSelectionCell(cell);
                    g.startEditingAtCell(cell);
                  } finally {
                    dm.endUpdate();
                  }
                },
              },
              {
                label: t('drawio.action.paste'),
                icon: <ClipboardPaste size={14} />,
                onClick: () => Clipboard.paste(g),
              },
            ],
          });
        }
      });
    },
    [t, deleteSelected],
  );

  // ── 快捷键处理 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      } else if (e.key === 'Escape') {
        // 取消当前操作
        const ds = drawState.current;
        ds.isDrawing = false;

        // 移除框选框
        if (ds.selectionBox) {
          ds.selectionBox.remove();
          ds.selectionBox = null;
        }

        // 移除预览单元
        if (ds.previewCell && graphRef.current) {
          graphRef.current.removeCells([ds.previewCell]);
          ds.previewCell = null;
        }

        // 移除箭头预览线
        if (containerRef.current) {
          const svg = containerRef.current.querySelector('svg');
          if (svg) {
            const line = svg.querySelector('line[marker-end="url(#arrow)"]');
            if (line) line.remove();
          }
        }

        ds.arrowSource = null;
        setActiveTool('select');
        activeToolRef.current = 'select';
        setMenuState(null);

        // 恢复画布交互
        if (graphRef.current) graphRef.current.setEnabled(true);
        if (containerRef.current) containerRef.current.style.cursor = 'default';
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);

  // ── 错误状态渲染 ──
  if (error) {
    return (
      <div className="w-full h-full canvas-grid-bg relative overflow-hidden flex items-center justify-center">
        <div className="max-w-lg w-full mx-4 p-6 rounded-xl bg-[var(--bg-glass)] backdrop-blur-sm border border-red-200/30">
          <p className="text-sm font-medium text-red-500 mb-3">{t('drawio.renderError')}</p>
          <p className="text-xs text-red-400/80 mb-4">{error}</p>
          {code && (
            <pre className="text-[11px] text-[var(--muted)] bg-[var(--surface)]/50 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all font-mono">
              {code}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // ── 正常状态渲染 ──
  return (
    <div className="w-full h-full canvas-grid-bg relative overflow-hidden">
      <DrawioToolbar
        activeTool={activeTool}
        onToolChange={handleSetActiveTool}
        onDelete={deleteSelected}
        onEditLabel={() => {
          const g = graphRef.current;
          if (!g) return;
          const cells = g.getSelectionCells();
          if (cells.length > 0) g.startEditingAtCell(cells[0]);
        }}
        hasSelection={hasSelection}
      />
      <ZoomToolbar
        scale={scale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToView={handleFitToView}
      />
      <div
        ref={containerRef}
        className="w-full h-full"
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
