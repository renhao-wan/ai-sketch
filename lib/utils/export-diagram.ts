/**
 * 图表导出工具函数
 * 支持将 SVG 转换为 PNG，以及触发浏览器下载
 */

/** 导出格式 */
export type ExportFormat = 'png' | 'svg' | 'code';

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 深度清理 SVG 元素，移除所有可能导致跨域问题的内容 */
function deepCleanSvg(svgEl: SVGSVGElement, width: number, height: number): SVGSVGElement {
  // 创建一个新的干净 SVG 元素
  const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  newSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  newSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  newSvg.setAttribute('width', String(width));
  newSvg.setAttribute('height', String(height));

  // 获取 viewBox
  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    newSvg.setAttribute('viewBox', viewBox);
  }

  // 安全复制元素，跳过不安全的元素
  // 保留 style 元素（清理 @import），移除其他不安全标签
  const unsafeTags = new Set(['image', 'use', 'foreignObject', 'script', 'link']);
  const unsafeAttrs = new Set(['href', 'xlink:href', 'src', 'data-src']);

  function cloneNodeSafe(source: Element, target: Element) {
    // 复制安全的属性
    for (const attr of Array.from(source.attributes)) {
      if (!unsafeAttrs.has(attr.name) && !attr.name.startsWith('on')) {
        target.setAttribute(attr.name, attr.value);
      }
    }

    // 递归处理子节点
    for (const child of Array.from(source.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as Element;
        const tagName = childEl.tagName.toLowerCase();

        // 跳过不安全的标签
        if (unsafeTags.has(tagName)) continue;

        // 跳过包含外部引用的元素（但保留 style）
        if (tagName !== 'style') {
          const href = childEl.getAttribute('href') || childEl.getAttribute('xlink:href');
          if (href && !href.startsWith('#') && !href.startsWith('data:')) continue;
        }

        const newChild = document.createElementNS('http://www.w3.org/2000/svg', tagName);

        // 对于 style 元素，清理 @import 语句但保留其他样式
        if (tagName === 'style' && child.textContent) {
          newChild.textContent = child.textContent.replace(/@import[^;]+;/g, '');
        } else {
          cloneNodeSafe(childEl, newChild);
        }

        target.appendChild(newChild);
      } else if (child.nodeType === Node.TEXT_NODE) {
        target.appendChild(child.cloneNode(false));
      }
    }
  }

  // 复制根 SVG 的内容
  cloneNodeSafe(svgEl, newSvg);

  return newSvg;
}

/** 将 SVG 字符串转换为 PNG Blob */
export function svgToPng(svgString: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const scale = 2; // 2x 分辨率
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('无法创建 Canvas 上下文'));

    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    // 确保 SVG 字符串是有效的
    if (!svgString || svgString.trim() === '') {
      return reject(new Error('SVG 内容为空'));
    }

    // 解析 SVG 并深度清理
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.documentElement as unknown as SVGSVGElement;

    // 检查解析是否成功
    if (svgEl.tagName === 'parsererror') {
      return reject(new Error('SVG 解析失败'));
    }

    // 深度清理 SVG
    const cleanedSvg = deepCleanSvg(svgEl, width, height);
    const cleanedSvgString = new XMLSerializer().serializeToString(cleanedSvg);

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
      reject(new Error('SVG 图片加载失败，请尝试导出 SVG 格式'));
    };

    // 使用 Blob URL
    const blob = new Blob([cleanedSvgString], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(blob);
  });
}

/** 获取文件扩展名 */
export function getFileExtension(format: ExportFormat, diagramFormat: string): string {
  if (format === 'png') return 'png';
  if (format === 'svg') return 'svg';
  // code format
  return diagramFormat === 'excalidraw' ? 'json' : diagramFormat === 'mermaid' ? 'mmd' : 'drawio';
}

/** 获取 MIME 类型 */
export function getMimeType(format: ExportFormat): string {
  if (format === 'png') return 'image/png';
  if (format === 'svg') return 'image/svg+xml';
  return 'text/plain';
}
