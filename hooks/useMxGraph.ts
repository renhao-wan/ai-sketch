'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Graph, FitPlugin } from '@maxgraph/core';

export type DrawioTool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow';

interface UseMxGraphOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  code: string;
}

interface UseMxGraphReturn {
  graph: Graph | null;
  error: string | null;
  activeTool: DrawioTool;
  setActiveTool: (tool: DrawioTool) => void;
  deleteSelected: () => void;
  exportXml: () => string;
  hasSelection: boolean;
}

/** 缓存的 @maxgraph/core 模块引用，避免重复动态导入 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedCodecClass: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedXmlUtils: any = null;

/**
 * 内部辅助函数：解析 XML 并加载到 graph。
 *
 * @maxgraph/core API 说明：
 * - 使用 xmlUtils.parseXml 解析 XML 字符串
 * - 使用 Codec 解码 XML 到 GraphDataModel
 * - 需要先调用 registerModelCodecs 注册编解码器
 * - getDataModel() 替代了旧版 mxGraph 的 getModel()
 */
function loadXml(
  graph: Graph,
  xml: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xmlUtilsModule: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CodecClass: any,
  setError: (msg: string | null) => void,
) {
  try {
    // 处理 mxfile 包装：提取内部 mxGraphModel
    let cleanXml = xml.trim();
    const mxGraphModelMatch = cleanXml.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
    if (mxGraphModelMatch) {
      cleanXml = mxGraphModelMatch[0];
    }

    const doc = xmlUtilsModule.parseXml(cleanXml);
    if (!doc || !doc.documentElement) {
      setError('XML 解析失败：无效的 XML 结构');
      return;
    }

    const codec = new CodecClass(doc);
    graph.getDataModel().beginUpdate();
    try {
      graph.getDataModel().clear();
      codec.decode(doc.documentElement, graph.getDataModel());
    } finally {
      graph.getDataModel().endUpdate();
    }

    // 自动适配视图
    // FitPlugin 是 Graph 的默认插件之一
    const fitPlugin = graph.getPlugin<FitPlugin>('fit');
    if (fitPlugin) {
      fitPlugin.fit();
      fitPlugin.fitCenter();
    }
    setError(null);
  } catch (e) {
    setError('XML 解析错误: ' + (e as Error).message);
  }
}

export function useMxGraph({ containerRef, code }: UseMxGraphOptions): UseMxGraphReturn {
  const graphRef = useRef<Graph | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DrawioTool>('select');
  const [hasSelection, setHasSelection] = useState(false);
  const codeRef = useRef(code);

  // 保持 codeRef 同步
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // 初始化 mxGraph
  useEffect(() => {
    const container = containerRef.current;
    if (!container || graphRef.current) return;

    let graphInstance: Graph | null = null;
    let wheelHandler: ((e: WheelEvent) => void) | null = null;

    import('@maxgraph/core').then(({
      Graph: GraphClass,
      xmlUtils: xmlUtilsMod,
      Codec: CodecClass,
      InternalEvent,
      registerModelCodecs,
    }) => {
      // 注册编解码器（Codec 使用前必须调用）
      registerModelCodecs();

      // 缓存模块引用供 exportXml 使用
      cachedCodecClass = CodecClass;
      cachedXmlUtils = xmlUtilsMod;

      graphInstance = new GraphClass(container);

      // 配置编辑能力
      graphInstance.setEnabled(true);
      graphInstance.setCellsSelectable(true);
      graphInstance.setCellsMovable(true);
      graphInstance.setCellsResizable(true);
      graphInstance.setCellsEditable(true);
      graphInstance.setConnectable(true);
      graphInstance.setDropEnabled(false);

      // 启用内置缩放/平移
      graphInstance.setPanning(true);
      graphInstance.centerZoom = true;

      // 滚轮缩放
      wheelHandler = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          graphInstance!.zoom(delta);
        }
      };
      container.addEventListener('wheel', wheelHandler, { passive: false });

      // 监听选中变化
      graphInstance.getSelectionModel().addListener(InternalEvent.CHANGE, () => {
        const cells = graphInstance!.getSelectionCells();
        setHasSelection(cells.length > 0);
      });

      graphRef.current = graphInstance;
      setGraph(graphInstance);

      // 解析初始 XML
      const xml = codeRef.current;
      if (xml) {
        loadXml(graphInstance, xml, xmlUtilsMod, CodecClass, setError);
      }
    }).catch((e: Error) => {
      setError('加载 @maxgraph/core 失败: ' + e.message);
    });

    return () => {
      if (wheelHandler) {
        container.removeEventListener('wheel', wheelHandler);
      }
      if (graphInstance) {
        graphInstance.destroy();
        graphRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // XML 变化时重新加载
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;

    import('@maxgraph/core').then(({ xmlUtils: xmlUtilsMod, Codec: CodecClass }) => {
      if (code) {
        loadXml(g, code, xmlUtilsMod, CodecClass, setError);
      } else {
        g.getDataModel().clear();
        setError(null);
      }
    });
  }, [code]);

  // 删除选中元素
  const deleteSelected = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const cells = g.getSelectionCells();
    if (cells.length > 0) {
      g.removeCells(cells);
    }
  }, []);

  // 导出当前 XML
  const exportXml = useCallback((): string => {
    const g = graphRef.current;
    if (!g || !cachedCodecClass || !cachedXmlUtils) return '';

    const encoder = new cachedCodecClass();
    const node = encoder.encode(g.getDataModel());
    return node ? cachedXmlUtils.getXml(node) : '';
  }, []);

  // 工具切换
  const handleSetActiveTool = useCallback((tool: DrawioTool) => {
    setActiveTool(tool);
    const g = graphRef.current;
    if (!g) return;

    if (tool === 'select') {
      g.setEnabled(true);
      if (containerRef.current) {
        containerRef.current.style.cursor = 'default';
      }
    } else {
      g.setEnabled(false);
      if (containerRef.current) {
        containerRef.current.style.cursor = 'crosshair';
      }
    }
  }, [containerRef]);

  return {
    graph,
    error,
    activeTool,
    setActiveTool: handleSetActiveTool,
    deleteSelected,
    exportXml,
    hasSelection,
  };
}
