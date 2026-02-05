import type { DomSnapshot, SerializedElement, SerializedNode } from '@like-cake/dom-serializer';
import { create, type Delta } from 'jsondiffpatch';
import type { DiffKind, DomDiffChange, DomDiffConfig, DomDiffResult } from './types';
import { DEFAULT_DOM_DIFF_CONFIG } from './types';

/**
 * Type guard to check if a node is an element
 */
function isElement(node: SerializedNode): node is SerializedElement {
  return node.type === 'element';
}

// Create a jsondiffpatch instance optimized for DOM comparison
const domDiffer = create({
  // Enable array move detection
  arrays: {
    detectMove: true,
    includeValueOnMove: false,
  },
  // Use tag name and attributes for object matching
  objectHash: (obj: unknown) => {
    if (obj && typeof obj === 'object' && 'type' in obj) {
      const node = obj as SerializedNode;
      if (isElement(node)) {
        return `${node.tagName}:${node.attributes?.id || ''}:${node.attributes?.['data-testid'] || ''}`;
      }
      return `${node.type}:${node.id}`;
    }
    return JSON.stringify(obj);
  },
  // Property filter for comparison
  propertyFilter: (name: string) => {
    // Skip internal properties
    return !name.startsWith('_');
  },
});

/**
 * Filters out nodes that match ignore selectors
 */
function filterIgnoredNodes(
  node: SerializedNode,
  config: Required<DomDiffConfig>,
  depth: number = 0
): SerializedNode | null {
  // Check max depth
  if (depth > config.maxDepth) {
    return null;
  }

  // Non-element nodes pass through with minimal filtering
  if (!isElement(node)) {
    // For text nodes, handle whitespace
    if (node.type === 'text') {
      let content = node.content;
      if (config.ignoreWhitespace) {
        content = content.trim();
        if (content === '') {
          return null;
        }
      }
      if (!config.compareText) {
        return null;
      }
      return { ...node, content };
    }
    // Skip comments
    if (node.type === 'comment') {
      return null;
    }
    return node;
  }

  // Check if this element should be ignored
  if (config.ignoreSelectors.includes(node.tagName.toLowerCase())) {
    return null;
  }

  // Filter attributes
  const filteredAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.attributes)) {
    if (!config.ignoreAttributes.includes(key)) {
      filteredAttributes[key] = value;
    }
  }

  // Handle styles
  let computedStyle = config.compareStyles ? node.computedStyle : undefined;
  if (computedStyle && config.styleProperties.length > 0) {
    const filteredStyles: Record<string, string> = {};
    for (const prop of config.styleProperties) {
      if (computedStyle[prop]) {
        filteredStyles[prop] = computedStyle[prop];
      }
    }
    computedStyle = Object.keys(filteredStyles).length > 0 ? filteredStyles : undefined;
  }

  // Recursively filter children
  const filteredChildren: SerializedNode[] = [];
  for (const child of node.children) {
    const filtered = filterIgnoredNodes(child, config, depth + 1);
    if (filtered) {
      filteredChildren.push(filtered);
    }
  }

  return {
    ...node,
    attributes: filteredAttributes,
    computedStyle,
    children: filteredChildren,
  };
}

/**
 * Converts jsondiffpatch delta to our DomDiffChange format
 */
function convertDelta(
  delta: Delta | undefined,
  path: string = '',
  parentTagName?: string
): DomDiffChange[] {
  if (!delta) {
    return [];
  }

  const changes: DomDiffChange[] = [];

  // Process each key in the delta
  for (const [key, value] of Object.entries(delta)) {
    if (key === '_t') continue; // Skip type marker

    const currentPath = path ? `${path}/${key}` : key;

    if (Array.isArray(value)) {
      // This is a change
      if (value.length === 1) {
        // Added
        changes.push(createChange('added', currentPath, value[0], parentTagName));
      } else if (value.length === 2) {
        // Modified
        changes.push(createChange('modified', currentPath, value[0], parentTagName, value[1]));
      } else if (value.length === 3) {
        if (value[2] === 0) {
          // Deleted
          changes.push(createChange('deleted', currentPath, value[0], parentTagName));
        } else if (value[2] === 2) {
          // Text diff (not used for DOM)
          changes.push(createChange('modified', currentPath, value[0], parentTagName, value[1]));
        } else if (value[2] === 3) {
          // Moved
          changes.push({
            kind: 'moved',
            path: currentPath,
            tagName: parentTagName,
            changeType: 'structure',
            description: `Element moved to ${currentPath}`,
          });
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      // Nested object - recurse
      const nestedTagName = getTagNameFromDelta(value) || parentTagName;
      changes.push(...convertDelta(value as Delta, currentPath, nestedTagName));
    }
  }

  return changes;
}

/**
 * Creates a DomDiffChange from delta information
 */
function createChange(
  kind: DiffKind,
  path: string,
  oldValue: unknown,
  tagName?: string,
  newValue?: unknown
): DomDiffChange {
  const changeType = determineChangeType(path, oldValue, newValue);
  const attributeName = changeType === 'attribute' ? path.split('/').pop() : undefined;

  return {
    kind,
    path,
    tagName,
    changeType,
    attributeName,
    oldValue: kind !== 'added' ? oldValue : undefined,
    newValue: kind !== 'deleted' ? (newValue ?? oldValue) : undefined,
    description: generateDomDescription(kind, path, changeType, oldValue, newValue),
  };
}

/**
 * Determines the type of change based on path and values
 */
function determineChangeType(
  path: string,
  oldValue: unknown,
  newValue?: unknown
): 'attribute' | 'text' | 'element' | 'structure' {
  const pathParts = path.split('/');
  const lastPart = pathParts[pathParts.length - 1];

  if (lastPart === 'content' && pathParts.includes('text')) {
    return 'text';
  }

  if (pathParts.includes('attributes')) {
    return 'attribute';
  }

  if (
    (isSerializedElementLike(oldValue) && oldValue.type === 'element') ||
    (isSerializedElementLike(newValue) && newValue.type === 'element')
  ) {
    return 'element';
  }

  return 'structure';
}

/**
 * Type guard for element-like objects
 */
function isSerializedElementLike(value: unknown): value is { type: string; tagName?: string } {
  return typeof value === 'object' && value !== null && 'type' in value;
}

/**
 * Extracts tag name from a delta value if possible
 */
function getTagNameFromDelta(delta: object): string | undefined {
  if ('tagName' in delta) {
    const tagName = (delta as { tagName: unknown }).tagName;
    if (Array.isArray(tagName) && tagName.length >= 1) {
      return String(tagName[tagName.length === 1 ? 0 : 1]);
    }
    return String(tagName);
  }
  return undefined;
}

/**
 * Generates human-readable description for DOM change
 */
function generateDomDescription(
  kind: DiffKind,
  path: string,
  changeType: 'attribute' | 'text' | 'element' | 'structure',
  oldValue: unknown,
  newValue?: unknown
): string {
  const pathStr = path.replace(/\//g, ' > ');

  switch (kind) {
    case 'added':
      if (changeType === 'element') {
        const tagName =
          isSerializedElementLike(oldValue) && 'tagName' in oldValue
            ? (oldValue as { tagName: string }).tagName
            : 'element';
        return `Added <${tagName}> at ${pathStr}`;
      }
      if (changeType === 'attribute') {
        return `Added attribute at ${pathStr}: ${formatDomValue(oldValue)}`;
      }
      return `Added ${changeType} at ${pathStr}`;

    case 'deleted':
      if (changeType === 'element') {
        const tagName =
          isSerializedElementLike(oldValue) && 'tagName' in oldValue
            ? (oldValue as { tagName: string }).tagName
            : 'element';
        return `Removed <${tagName}> from ${pathStr}`;
      }
      if (changeType === 'attribute') {
        return `Removed attribute at ${pathStr}`;
      }
      return `Removed ${changeType} from ${pathStr}`;

    case 'modified':
      if (changeType === 'text') {
        return `Text changed at ${pathStr}: "${formatDomValue(oldValue)}" → "${formatDomValue(newValue)}"`;
      }
      if (changeType === 'attribute') {
        return `Attribute changed at ${pathStr}: "${formatDomValue(oldValue)}" → "${formatDomValue(newValue)}"`;
      }
      return `Modified ${changeType} at ${pathStr}`;

    case 'moved':
      return `Element moved to ${pathStr}`;

    default:
      return `Changed ${changeType} at ${pathStr}`;
  }
}

/**
 * Formats a DOM value for display
 */
function formatDomValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.substring(0, 50) + (value.length > 50 ? '...' : '');
  if (isSerializedElementLike(value) && 'tagName' in value) {
    return `<${(value as { tagName: string }).tagName}>`;
  }
  return String(value);
}

/**
 * Counts changes by kind
 */
function countChanges(changes: DomDiffChange[]): DomDiffResult['summary'] {
  return changes.reduce(
    (acc, change) => {
      switch (change.kind) {
        case 'added':
          acc.added++;
          break;
        case 'deleted':
          acc.removed++;
          break;
        case 'modified':
          acc.modified++;
          break;
        case 'moved':
          acc.moved++;
          break;
      }
      return acc;
    },
    { added: 0, removed: 0, modified: 0, moved: 0 }
  );
}

/**
 * Compares two DOM snapshots
 */
export function compareDomSnapshots(
  baseline: DomSnapshot,
  actual: DomSnapshot,
  userConfig: DomDiffConfig = {}
): DomDiffResult {
  const config: Required<DomDiffConfig> = {
    ...DEFAULT_DOM_DIFF_CONFIG,
    ...userConfig,
  };

  // Filter out ignored elements
  const filteredBaseline = filterIgnoredNodes(baseline.root, config);
  const filteredActual = filterIgnoredNodes(actual.root, config);

  // Generate delta using jsondiffpatch
  const delta = domDiffer.diff(filteredBaseline, filteredActual);

  // Convert delta to our format
  const differences = convertDelta(delta);

  // Calculate summary
  const summary = countChanges(differences);
  const totalDiffs = differences.length;

  return {
    passed: totalDiffs === 0,
    differences,
    totalDiffs,
    delta,
    summary,
  };
}

/**
 * Creates a formatted report of DOM differences
 */
export function formatDomDiffReport(result: DomDiffResult): string {
  const lines: string[] = [];

  lines.push('=== DOM Comparison Report ===');
  lines.push('');
  lines.push(`Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push(`Total Differences: ${result.totalDiffs}`);
  lines.push(`  Added: ${result.summary.added}`);
  lines.push(`  Removed: ${result.summary.removed}`);
  lines.push(`  Modified: ${result.summary.modified}`);
  lines.push(`  Moved: ${result.summary.moved}`);
  lines.push('');

  if (result.differences.length > 0) {
    lines.push('--- Differences ---');
    for (const diff of result.differences) {
      const icon =
        diff.kind === 'added'
          ? '+'
          : diff.kind === 'deleted'
            ? '-'
            : diff.kind === 'moved'
              ? '→'
              : '~';
      lines.push(`  [${icon}] ${diff.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Quick check if two DOM snapshots are identical (ignoring config)
 */
export function areDomSnapshotsEqual(baseline: DomSnapshot, actual: DomSnapshot): boolean {
  const delta = domDiffer.diff(baseline.root, actual.root);
  return delta === undefined;
}
