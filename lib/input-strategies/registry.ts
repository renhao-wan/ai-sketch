/**
 * Input strategy registry — provides access to input handling strategies and orchestrator.
 */

import { fileStrategy } from './file-strategy';
import { imageStrategy } from './image-strategy';
import { InputOrchestrator } from './orchestrator';

/**
 * Pre-configured orchestrator for multi-file handling.
 * File strategies are ordered by priority (image first, then file).
 */
export const orchestrator = new InputOrchestrator([imageStrategy, fileStrategy]);

export { imageStrategy } from './image-strategy';
export { fileStrategy } from './file-strategy';
