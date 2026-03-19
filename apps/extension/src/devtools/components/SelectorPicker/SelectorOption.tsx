import type { SelectorCandidate } from '@like-cake/ast-types';

interface SelectorOptionProps {
  candidate: SelectorCandidate;
  isSelected: boolean;
  isRecommended: boolean;
  stabilityScore: number;
  onSelect: () => void;
}

/**
 * Individual selector option with stability bar and metadata
 */
export function SelectorOption({
  candidate,
  isSelected,
  isRecommended,
  stabilityScore,
  onSelect,
}: SelectorOptionProps) {
  // Color the stability bar based on score
  const barColor =
    stabilityScore >= 70 ? 'bg-green-500' : stabilityScore >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div
      className={`p-3 rounded-md cursor-pointer transition-colors border ${
        isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-center gap-2">
        {/* Radio indicator */}
        <div
          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            isSelected ? 'border-blue-500' : 'border-gray-300'
          }`}
        >
          {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
        </div>

        {/* Selector text */}
        <code className="text-xs text-gray-600 font-mono truncate flex-1">
          {candidate.selector}
        </code>

        {/* Recommended badge */}
        {isRecommended && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded flex-shrink-0">
            Recommended
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div className="mt-2 flex items-center gap-3 ml-6">
        {/* Stability bar */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 w-[52px]">Stability:</span>
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${stabilityScore}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 w-7 text-right">{stabilityScore}%</span>
        </div>

        {/* Divider */}
        <span className="text-gray-300">|</span>

        {/* Unique indicator */}
        <span className="text-[10px] text-gray-500">
          Unique:{' '}
          {candidate.isUnique ? (
            <span className="text-green-600">Yes</span>
          ) : (
            <span className="text-red-500">No</span>
          )}
        </span>

        {/* Divider */}
        <span className="text-gray-300">|</span>

        {/* Readable indicator */}
        <span className="text-[10px] text-gray-500">
          Readable:{' '}
          {candidate.isReadable ? (
            <span className="text-green-600">Yes</span>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </span>
      </div>
    </div>
  );
}
