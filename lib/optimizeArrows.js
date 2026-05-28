/**
 * Optimize Excalidraw arrow coordinates by aligning them to the center of bound element edges
 */

/**
 * Determine the optimal edge pairs for two elements based on their relative positions
 * Returns the edge directions that should be used for start and end elements
 */
function determineEdges(startEle, endEle) {
  const startX = startEle.x || 0;
  const startY = startEle.y || 0;
  const startWidth = startEle.width || 100;
  const startHeight = startEle.height || 100;

  const endX = endEle.x || 0;
  const endY = endEle.y || 0;
  const endWidth = endEle.width || 100;
  const endHeight = endEle.height || 100;

  // Calculate center points for accurate relative positioning
  const startCenterX = startX + startWidth / 2;
  const startCenterY = startY + startHeight / 2;
  const endCenterX = endX + endWidth / 2;
  const endCenterY = endY + endHeight / 2;

  // dx and dy only used for determining relative position direction
  const dx = startCenterX - endCenterX;
  const dy = startCenterY - endCenterY;

  // Calculate distance differences between possible edge pairs
  const leftToRightDistance = (startX - (endX + endWidth));
  const rightToLeftDistance = -((startX + startWidth) - endX);
  const topToBottomDistance = (startY - (endY + endHeight));
  const bottomToTopDistance = -((startY + startHeight) - endY);

  let startEdge, endEdge;

  if (dx > 0 && dy > 0) {
    // startEle is in lower-right quadrant relative to endEle
    if (leftToRightDistance > topToBottomDistance) {
      startEdge = 'left'; endEdge = 'right';
    } else {
      startEdge = 'top'; endEdge = 'bottom';
    }
  } else if (dx < 0 && dy > 0) {
    // startEle is in lower-left quadrant relative to endEle
    if (rightToLeftDistance > topToBottomDistance) {
      startEdge = 'right'; endEdge = 'left';
    } else {
      startEdge = 'top'; endEdge = 'bottom';
    }
  } else if (dx > 0 && dy < 0) {
    // startEle is in upper-right quadrant relative to endEle
    if (leftToRightDistance > bottomToTopDistance) {
      startEdge = 'left'; endEdge = 'right';
    } else {
      startEdge = 'bottom'; endEdge = 'top';
    }
  } else if (dx < 0 && dy < 0) {
    // startEle is in upper-left quadrant relative to endEle
    if (rightToLeftDistance > bottomToTopDistance) {
      startEdge = 'right'; endEdge = 'left';
    } else {
      startEdge = 'bottom'; endEdge = 'top';
    }
  } else if (dx === 0 && dy > 0) {
    // Directly below
    startEdge = 'top'; endEdge = 'bottom';
  } else if (dx === 0 && dy < 0) {
    // Directly above
    startEdge = 'bottom'; endEdge = 'top';
  } else if (dx > 0 && dy === 0) {
    // Directly to the right
    startEdge = 'left'; endEdge = 'right';
  } else if (dx < 0 && dy === 0) {
    // Directly to the left
    startEdge = 'right'; endEdge = 'left';
  } else {
    // Default case (overlapping elements)
    startEdge = 'right'; endEdge = 'left';
  }

  return { startEdge, endEdge };
}

/**
 * Get the center point of a specified edge for an element
 */
function getEdgeCenter(element, edge) {
  const x = element.x || 0;
  const y = element.y || 0;
  const width = element.width || 100;
  const height = element.height || 100;

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
      // Default to right edge
      return { x: x + width, y: y + height / 2 };
  }
}

/**
 * Get the optimal edge center point for start element
 */
function getStartEdgeCenter(startEle, endEle) {
  const { startEdge } = determineEdges(startEle, endEle);
  return getEdgeCenter(startEle, startEdge);
}

/**
 * Get the optimal edge center point for end element
 */
function getEndEdgeCenter(endEle, startEle) {
  const { endEdge } = determineEdges(startEle, endEle);
  return getEdgeCenter(endEle, endEdge);
}

/**
 * Optimize arrow/line coordinates to align with bound element edge centers
 */
export function optimizeExcalidrawCode(codeString) {
  if (!codeString || typeof codeString !== 'string') {
    return codeString;
  }

  try {
    // Step 1: Parse JSON string to array
    const cleanedCode = codeString.trim();
    const arrayMatch = cleanedCode.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      console.error('No array found in code');
      return codeString;
    }

    const elements = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(elements)) {
      console.error('Parsed code is not an array');
      return codeString;
    }

    // Create a map of elements by ID for quick lookup
    const elementMap = new Map();
    elements.forEach(el => {
      if (el.id) {
        elementMap.set(el.id, el);
      }
    });

    // Step 2 & 3: Find and optimize arrows/lines with bound elements
    const optimizedElements = elements.map(element => {
      // Only process arrow and line elements
      if (element.type !== 'arrow' && element.type !== 'line') {
        return element;
      }

      const optimized = { ...element };
      let needsOptimization = false;

      // Get bound elements
      const startEle = element.start && element.start.id ? elementMap.get(element.start.id) : null;
      const endEle = element.end && element.end.id ? elementMap.get(element.end.id) : null;


      // Both start and end must be bound to calculate correctly
      if (startEle && endEle) {

        // Calculate start point (arrow.x, arrow.y)
        const startEdgeCenter = getStartEdgeCenter(startEle, endEle);
        optimized.x = startEdgeCenter.x;
        optimized.y = startEdgeCenter.y;

        // Calculate end point and derive width/height
        const endEdgeCenter = getEndEdgeCenter(endEle, startEle);
        optimized.width = endEdgeCenter.x - startEdgeCenter.x;
        optimized.height = endEdgeCenter.y - startEdgeCenter.y;


        needsOptimization = true;
      }

      // Fix Excalidraw rendering bug: line-type elements with width 0 should be 1
      if ((element.type === 'arrow' || element.type === 'line') && optimized.width === 0) {
        optimized.width = 1;
        needsOptimization = true;
      }

      return needsOptimization ? optimized : element;

    });

    // Step 4: Convert back to JSON string
    return JSON.stringify(optimizedElements, null, 2);
  } catch (error) {
    console.error('Failed to optimize arrows:', error);
    return codeString; // Return original code if optimization fails
  }
}

