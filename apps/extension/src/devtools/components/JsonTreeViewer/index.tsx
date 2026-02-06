import { TreeNode } from './TreeNode';
import { getValuePreview } from './PathBuilder';

interface JsonTreeViewerProps {
  /** JSON data to display */
  data: unknown;
  /** Callback when a path is selected */
  onSelect: (jsonPath: string, value: unknown) => void;
  /** Currently selected JSONPath */
  selectedPath?: string;
  /** Default depth to auto-expand (default: 2) */
  defaultExpandDepth?: number;
  /** Maximum height of the tree viewer */
  maxHeight?: string;
}

/**
 * Interactive JSON tree viewer that generates JSONPath on click
 *
 * Renders JSON data as an expandable tree where clicking any value
 * generates the corresponding JSONPath expression.
 */
export function JsonTreeViewer({
  data,
  onSelect,
  selectedPath,
  defaultExpandDepth = 2,
  maxHeight = '300px',
}: JsonTreeViewerProps) {
  if (data === null || data === undefined) {
    return (
      <div className="p-3 bg-gray-900 rounded-md text-sm text-gray-500 text-center">
        No data available. Run the scenario first to see API responses.
      </div>
    );
  }

  const isExpandable = typeof data === 'object';

  return (
    <div className="bg-gray-900 rounded-md border border-gray-700 overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">Response Preview</span>
        <span className="text-[10px] text-gray-600">Click a value to select its path</span>
      </div>
      <div
        className="overflow-y-auto p-2 text-sm"
        style={{ maxHeight }}
      >
        {isExpandable ? (
          Array.isArray(data) ? (
            (data as unknown[]).map((item, index) => (
              <TreeNode
                key={index}
                nodeKey={index}
                value={item}
                path={[index]}
                onSelect={onSelect}
                selectedPath={selectedPath}
                defaultExpandDepth={defaultExpandDepth}
              />
            ))
          ) : (
            Object.entries(data as Record<string, unknown>).map(([key, value]) => (
              <TreeNode
                key={key}
                nodeKey={key}
                value={value}
                path={[key]}
                onSelect={onSelect}
                selectedPath={selectedPath}
                defaultExpandDepth={defaultExpandDepth}
              />
            ))
          )
        ) : (
          <div className="px-2 py-1 text-xs text-gray-400 font-mono">
            {getValuePreview(data)}
          </div>
        )}
      </div>
    </div>
  );
}

export { buildJsonPath, getValueType, getValuePreview } from './PathBuilder';
