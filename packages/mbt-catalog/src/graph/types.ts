/**
 * Path generation types for MBT graph traversal
 */

import type { TestPath } from '../converters/types';

/** Graph traversal strategy */
export type TraversalStrategy = 'shortest' | 'simple';

/** Options for path generation */
export interface PathGenerationOptions {
  /** Which traversal algorithm to use. Default: 'shortest' */
  strategy?: TraversalStrategy;
  /** Maximum number of paths to return. 0 = unlimited. Default: 0 */
  maxPaths?: number;
  /** Whether to filter out paths that don't reach a final state. Default: true */
  requireFinalState?: boolean;
}

/** Result of path generation */
export interface PathGenerationResult {
  /** Generated test paths */
  paths: TestPath[];
  /** Total paths found before maxPaths limit */
  totalFound: number;
  /** Strategy that was used */
  strategy: TraversalStrategy;
  /** Warnings (e.g., unreachable states, filtered paths) */
  warnings: string[];
}
