import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowNode } from '@like-cake/ast-types';

interface FlowCardProps {
  flow: {
    id: string;
    name: string;
    description?: string;
    nodes: FlowNode[];
    updatedAt: number;
  };
  isActive: boolean;
  onSelect: (flowId: string) => void;
  onDelete: (flowId: string) => void;
  onDuplicate: (flowId: string) => void;
  onRename: (flowId: string, newName: string) => void;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export function FlowCard({
  flow,
  isActive,
  onSelect,
  onDelete,
  onDuplicate,
  onRename,
}: FlowCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(flow.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleSelect = useCallback(() => {
    if (!isRenaming) {
      onSelect(flow.id);
    }
  }, [flow.id, isRenaming, onSelect]);

  const handleMenuToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsMenuOpen((prev) => !prev);
    },
    []
  );

  const handleRenameStart = useCallback(() => {
    setIsRenaming(true);
    setRenameValue(flow.name);
    setIsMenuOpen(false);
  }, [flow.name]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== flow.name) {
      onRename(flow.id, trimmed);
    }
    setIsRenaming(false);
  }, [flow.id, flow.name, renameValue, onRename]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleRenameSubmit();
      } else if (e.key === 'Escape') {
        setIsRenaming(false);
        setRenameValue(flow.name);
      }
    },
    [flow.name, handleRenameSubmit]
  );

  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDuplicate(flow.id);
      setIsMenuOpen(false);
    },
    [flow.id, onDuplicate]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(flow.id);
      setIsMenuOpen(false);
    },
    [flow.id, onDelete]
  );

  const nodeCount = flow.nodes.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      }}
      className={`
        relative px-4 py-3 cursor-pointer transition-colors
        border-l-2 group
        ${
          isActive
            ? 'bg-blue-900/20 border-l-blue-500 hover:bg-blue-900/30'
            : 'border-l-transparent hover:bg-gray-700/50'
        }
      `}
      data-test-id={`flow-card-${flow.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Flow info */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div onClick={(e) => e.stopPropagation()}>
              <label htmlFor={`rename-input-${flow.id}`} className="sr-only">
                플로우 이름 변경
              </label>
              <input
                id={`rename-input-${flow.id}`}
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
                className="w-full px-1.5 py-0.5 bg-gray-900 border border-blue-500 rounded text-sm text-white focus:outline-none"
                data-test-id={`flow-rename-input-${flow.id}`}
              />
            </div>
          ) : (
            <h3 className="text-sm font-medium text-gray-100 truncate">
              {flow.name}
            </h3>
          )}

          {flow.description && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">
              {flow.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-gray-500">
              <NodeCountIcon />
              {nodeCount}개 노드
            </span>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(flow.updatedAt)}
            </span>
          </div>
        </div>

        {/* Context menu button */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={handleMenuToggle}
            className="p-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded hover:bg-gray-600"
            aria-label="플로우 메뉴"
            data-test-id={`flow-menu-button-${flow.id}`}
          >
            <MoreIcon />
          </button>

          {/* Dropdown menu */}
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-10 py-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameStart();
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-600 transition-colors"
                data-test-id={`flow-rename-action-${flow.id}`}
              >
                이름 변경
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-600 transition-colors"
                data-test-id={`flow-duplicate-action-${flow.id}`}
              >
                복제
              </button>
              <div className="border-t border-gray-600 my-1" />
              <button
                type="button"
                onClick={handleDelete}
                className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-900/30 transition-colors"
                data-test-id={`flow-delete-action-${flow.id}`}
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NodeCountIcon() {
  return (
    <svg
      className="w-3 h-3 inline-block mr-0.5 -mt-px"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h7"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
