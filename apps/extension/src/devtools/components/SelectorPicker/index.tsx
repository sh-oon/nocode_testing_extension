import { useState } from 'react';
import type { SelectorCandidate } from '@like-cake/ast-types';
import { calculateStabilityScore } from '@like-cake/selector-engine';
import { SelectorOption } from './SelectorOption';

interface SelectorPickerProps {
  /** Available selector candidates from recording */
  candidates: SelectorCandidate[];
  /** Currently selected selector string */
  currentSelector?: string;
  /** HTML preview of the target element */
  elementHtml?: string;
  /** Callback when a selector is chosen */
  onSelect: (selector: string) => void;
  /** Callback to test a selector (highlight in page) */
  onTest?: (selector: string) => void;
  /** Callback to highlight element in page */
  onHighlight?: (selector: string) => void;
  /** Close the picker */
  onClose: () => void;
}

/**
 * Selector Recommender UI
 *
 * Shows multiple selector candidates ranked by stability,
 * allowing the user to choose the most appropriate one.
 */
export function SelectorPicker({
  candidates,
  currentSelector,
  elementHtml,
  onSelect,
  onTest,
  onHighlight,
  onClose,
}: SelectorPickerProps) {
  const [selected, setSelected] = useState(currentSelector || candidates[0]?.selector || '');
  const [customSelector, setCustomSelector] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // Score and rank candidates
  const scoredCandidates = candidates.map((c) => ({
    candidate: c,
    stabilityScore: calculateStabilityScore(c),
  }));
  scoredCandidates.sort((a, b) => b.stabilityScore - a.stabilityScore);

  const recommendedSelector = scoredCandidates[0]?.candidate.selector;

  const handleSave = () => {
    onSelect(isCustom ? customSelector : selected);
    onClose();
  };

  const handleTest = () => {
    const selector = isCustom ? customSelector : selected;
    onTest?.(selector);
  };

  const handleHighlight = () => {
    const selector = isCustom ? customSelector : selected;
    onHighlight?.(selector);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="selector-picker-title">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[560px] max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 id="selector-picker-title" className="text-lg font-semibold text-white">Select a Selector</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[65vh]">
          {/* Target Element Preview */}
          {elementHtml && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Target Element:
              </label>
              <pre className="p-2 bg-gray-900 rounded text-xs text-gray-400 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {elementHtml}
              </pre>
            </div>
          )}

          {/* Selector Options */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Choose a Selector:
            </label>

            {scoredCandidates.map(({ candidate, stabilityScore }) => (
              <SelectorOption
                key={`${candidate.strategy}-${candidate.selector}`}
                candidate={candidate}
                isSelected={!isCustom && selected === candidate.selector}
                isRecommended={candidate.selector === recommendedSelector}
                stabilityScore={stabilityScore}
                onSelect={() => {
                  setSelected(candidate.selector);
                  setIsCustom(false);
                }}
              />
            ))}

            {/* Custom selector option */}
            <div
              className={`p-3 rounded-md cursor-pointer transition-colors border ${
                isCustom
                  ? 'bg-primary-900/30 border-primary-500/50'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
              role="radio"
              aria-checked={isCustom}
              tabIndex={0}
              onClick={() => setIsCustom(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsCustom(true);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    isCustom ? 'border-primary-500' : 'border-gray-600'
                  }`}
                >
                  {isCustom && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                </div>
                <span className="text-xs text-gray-400">Custom...</span>
              </div>
              {isCustom && (
                <div className="mt-2 ml-6">
                  <input
                    type="text"
                    value={customSelector}
                    onChange={(e) => setCustomSelector(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter custom CSS selector..."
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          </div>

          {/* No candidates message */}
          {candidates.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No selector candidates available. Try recording an interaction first.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
          <div className="flex gap-2">
            {onHighlight && (
              <button
                type="button"
                onClick={handleHighlight}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Highlight in Page
              </button>
            )}
            {onTest && (
              <button
                type="button"
                onClick={handleTest}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Test Selector
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-md transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
