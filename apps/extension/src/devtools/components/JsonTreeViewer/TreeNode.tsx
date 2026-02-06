import { useState } from 'react';
import { buildJsonPath, getValueType, getValuePreview } from './PathBuilder';

interface TreeNodeProps {
  /** The key name or array index of this node */
  nodeKey: string | number;
  /** The value at this node */
  value: unknown;
  /** Path segments from root to this node */
  path: (string | number)[];
  /** Callback when a leaf value is selected */
  onSelect: (jsonPath: string, value: unknown) => void;
  /** Currently selected JSONPath (for highlight) */
  selectedPath?: string;
  /** Initial depth for auto-expanding (default: 2) */
  defaultExpandDepth?: number;
}

const TYPE_COLORS: Record<string, string> = {
  string: 'text-green-400',
  number: 'text-blue-400',
  boolean: 'text-amber-400',
  null: 'text-gray-500',
};

export function TreeNode({
  nodeKey,
  value,
  path,
  onSelect,
  selectedPath,
  defaultExpandDepth = 2,
}: TreeNodeProps) {
  const depth = path.length;
  const [isExpanded, setIsExpanded] = useState(depth < defaultExpandDepth);

  const valueType = getValueType(value);
  const jsonPath = buildJsonPath(path);
  const isSelected = selectedPath === jsonPath;
  const isExpandable = valueType === 'object' || valueType === 'array';

  const handleClick = () => {
    onSelect(jsonPath, value);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const entries = isExpandable
    ? Array.isArray(value)
      ? (value as unknown[]).map((v, i) => [i, v] as [number, unknown])
      : Object.entries(value as Record<string, unknown>)
    : [];

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer group hover:bg-gray-700/50 ${
          isSelected ? 'bg-primary-900/30 ring-1 ring-primary-500/50' : ''
        }`}
        style={{ paddingLeft: `${depth * 16}px` }}
        tabIndex={0}
        role="treeitem"
        {...(isExpandable ? { 'aria-expanded': isExpanded } : {})}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          } else if (e.key === 'ArrowLeft' && isExpandable && isExpanded) {
            e.preventDefault();
            setIsExpanded(false);
          } else if (e.key === 'ArrowRight' && isExpandable && !isExpanded) {
            e.preventDefault();
            setIsExpanded(true);
          }
        }}
      >
        {/* Expand/collapse toggle */}
        {isExpandable ? (
          <button
            type="button"
            onClick={handleToggle}
            className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 flex-shrink-0"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M6 6l8 4-8 4V6z" />
            </svg>
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center text-gray-600 flex-shrink-0">
            <span className="w-1 h-1 rounded-full bg-current" />
          </span>
        )}

        {/* Key name */}
        <span className="text-purple-300 text-xs font-mono">
          {typeof nodeKey === 'number' ? `[${nodeKey}]` : nodeKey}
        </span>

        <span className="text-gray-600 text-xs">:</span>

        {/* Value or type summary */}
        {isExpandable ? (
          <span className="text-gray-500 text-xs">
            {valueType === 'array'
              ? `Array(${(value as unknown[]).length})`
              : `{${Object.keys(value as object).length}}`}
          </span>
        ) : (
          <span className={`text-xs font-mono truncate ${TYPE_COLORS[valueType] || 'text-white'}`}>
            {getValuePreview(value)}
          </span>
        )}

        {/* JSONPath hint on hover */}
        <span className="ml-auto text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity font-mono truncate max-w-[200px]">
          {jsonPath}
        </span>
      </div>

      {/* Children (recursive) */}
      {isExpandable && isExpanded && (
        <div>
          {entries.map(([key, childValue]) => (
            <TreeNode
              key={String(key)}
              nodeKey={key}
              value={childValue}
              path={[...path, key]}
              onSelect={onSelect}
              selectedPath={selectedPath}
              defaultExpandDepth={defaultExpandDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
