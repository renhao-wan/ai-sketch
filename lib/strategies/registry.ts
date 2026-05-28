/**
 * Strategy registry — factory for diagram format strategies.
 * Provides a single entry point to get the correct strategy by format key.
 */

import type { DiagramFormat, DiagramStrategy } from '@/types/diagram-strategy';
import { excalidrawStrategy } from './excalidraw-strategy';
import { mermaidStrategy } from './mermaid-strategy';
import { drawioStrategy } from './drawio-strategy';

const strategies: Record<DiagramFormat, DiagramStrategy> = {
  excalidraw: excalidrawStrategy,
  mermaid: mermaidStrategy,
  drawio: drawioStrategy,
};

/**
 * Get the strategy instance for a given diagram format.
 * Throws if the format is unknown.
 */
export function getStrategy(format: DiagramFormat): DiagramStrategy {
  const strategy = strategies[format];
  if (!strategy) throw new Error(`Unknown diagram format: ${format}`);
  return strategy;
}

/**
 * Get all supported format keys.
 */
export function getAllFormats(): DiagramFormat[] {
  return Object.keys(strategies) as DiagramFormat[];
}
