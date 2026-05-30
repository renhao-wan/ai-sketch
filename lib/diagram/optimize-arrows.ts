/**
 * Optimize Excalidraw arrow coordinates by aligning them to the center of bound element edges
 */

import type { ExcalidrawElement } from '@/types';
import { extractFirstJsonArray } from './json-repair';

type Edge = 'left' | 'right' | 'top' | 'bottom';

interface EdgeCenter {
  x: number;
  y: number;
}

interface EdgePair {
  startEdge: Edge;
  endEdge: Edge;
}

/**
 * Determine the optimal edge pairs for two elements based on their relative positions
 */
function determineEdges(startEle: ExcalidrawElement, endEle: ExcalidrawElement): EdgePair {
  const startX = startEle.x ?? 0;
  const startY = startEle.y ?? 0;
  const startWidth = startEle.width ?? 100;
  const startHeight = startEle.height ?? 100;

  const endX = endEle.x ?? 0;
  const endY = endEle.y ?? 0;
  const endWidth = endEle.width ?? 100;
  const endHeight = endEle.height ?? 100;

  const startCenterX = startX + startWidth / 2;
  const startCenterY = startY + startHeight / 2;
  const endCenterX = endX + endWidth / 2;
  const endCenterY = endY + endHeight / 2;

  const dx = startCenterX - endCenterX;
  const dy = startCenterY - endCenterY;

  const leftToRightDistance = (startX - (endX + endWidth));
  const rightToLeftDistance = -((startX + startWidth) - endX);
  const topToBottomDistance = (startY - (endY + endHeight));
  const bottomToTopDistance = -((startY + startHeight) - endY);

  let startEdge: Edge, endEdge: Edge;

  if (dx > 0 && dy > 0) {
    if (leftToRightDistance > topToBottomDistance) {
      startEdge = 'left'; endEdge = 'right';
    } else {
      startEdge = 'top'; endEdge = 'bottom';
    }
  } else if (dx < 0 && dy > 0) {
    if (rightToLeftDistance > topToBottomDistance) {
      startEdge = 'right'; endEdge = 'left';
    } else {
      startEdge = 'top'; endEdge = 'bottom';
    }
  } else if (dx > 0 && dy < 0) {
    if (leftToRightDistance > bottomToTopDistance) {
      startEdge = 'left'; endEdge = 'right';
    } else {
      startEdge = 'bottom'; endEdge = 'top';
    }
  } else if (dx < 0 && dy < 0) {
    if (rightToLeftDistance > bottomToTopDistance) {
      startEdge = 'right'; endEdge = 'left';
    } else {
      startEdge = 'bottom'; endEdge = 'top';
    }
  } else if (dx === 0 && dy > 0) {
    startEdge = 'top'; endEdge = 'bottom';
  } else if (dx === 0 && dy < 0) {
    startEdge = 'bottom'; endEdge = 'top';
  } else if (dx > 0 && dy === 0) {
    startEdge = 'left'; endEdge = 'right';
  } else if (dx < 0 && dy === 0) {
    startEdge = 'right'; endEdge = 'left';
  } else {
    startEdge = 'right'; endEdge = 'left';
  }

  return { startEdge, endEdge };
}

/**
 * Get the center point of a specified edge for an element
 */
function getEdgeCenter(element: ExcalidrawElement, edge: Edge): EdgeCenter {
  const x = element.x ?? 0;
  const y = element.y ?? 0;
  const width = element.width ?? 100;
  const height = element.height ?? 100;

  switch (edge) {
    case 'left':
      return { x: x, y: y + height / 2 };
    case 'right':
      return { x: x + width, y: y + height / 2 };
    case 'top':
      return { x: x + width / 2, y: y };
    case 'bottom':
      return { x: x + width / 2, y: y + height };
    default:
      return { x: x + width, y: y + height / 2 };
  }
}

/**
 * Get the optimal edge center point for start element
 */
function getStartEdgeCenter(startEle: ExcalidrawElement, endEle: ExcalidrawElement): EdgeCenter {
  const { startEdge } = determineEdges(startEle, endEle);
  return getEdgeCenter(startEle, startEdge);
}

/**
 * Get the optimal edge center point for end element
 */
function getEndEdgeCenter(endEle: ExcalidrawElement, startEle: ExcalidrawElement): EdgeCenter {
  const { endEdge } = determineEdges(startEle, endEle);
  return getEdgeCenter(endEle, endEdge);
}

/**
 * Optimize arrow/line coordinates to align with bound element edge centers
 */
export function optimizeExcalidrawCode(codeString: string): string {
  if (!codeString || typeof codeString !== 'string') {
    return codeString;
  }

  try {
    const cleanedCode = codeString.trim();
    const arrayStr = extractFirstJsonArray(cleanedCode);
    if (!arrayStr) {
      return codeString;
    }

    const elements = JSON.parse(arrayStr) as ExcalidrawElement[];
    if (!Array.isArray(elements)) {
      console.error('Parsed code is not an array');
      return codeString;
    }

    const elementMap = new Map<string, ExcalidrawElement>();
    elements.forEach(el => {
      if (el.id) {
        elementMap.set(el.id, el);
      }
    });

    const optimizedElements = elements.map(element => {
      if (element.type !== 'arrow' && element.type !== 'line') {
        return element;
      }

      const optimized = { ...element };
      let needsOptimization = false;

      const startEle = element.start && element.start.id ? elementMap.get(element.start.id) : null;
      const endEle = element.end && element.end.id ? elementMap.get(element.end.id) : null;

      if (startEle && endEle) {
        const startEdgeCenter = getStartEdgeCenter(startEle, endEle);
        optimized.x = startEdgeCenter.x;
        optimized.y = startEdgeCenter.y;

        const endEdgeCenter = getEndEdgeCenter(endEle, startEle);
        optimized.width = endEdgeCenter.x - startEdgeCenter.x;
        optimized.height = endEdgeCenter.y - startEdgeCenter.y;

        needsOptimization = true;
      }

      if ((element.type === 'arrow' || element.type === 'line') && optimized.width === 0) {
        optimized.width = 1;
        needsOptimization = true;
      }

      return needsOptimization ? optimized : element;
    });

    return JSON.stringify(optimizedElements, null, 2);
  } catch (error) {
    console.error('Failed to optimize arrows:', error);
    return codeString;
  }
}
