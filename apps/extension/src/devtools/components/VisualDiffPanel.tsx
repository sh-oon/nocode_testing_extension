import { useState } from 'react';
import type { VisualDiffResult } from '@like-cake/diff-engine';

type ViewMode = 'side-by-side' | 'overlay' | 'diff';

interface VisualDiffPanelProps {
  result?: VisualDiffResult;
  baselineImage?: string;
  actualImage?: string;
}

export function VisualDiffPanel({ result, baselineImage, actualImage }: VisualDiffPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [zoom, setZoom] = useState(1);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
        <ImageIcon />
        <p className="mt-2 text-sm">No screenshots to compare</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Status Banner */}
      <div
        className={`mb-4 px-4 py-3 rounded-lg flex items-center justify-between ${
          result.passed
            ? 'bg-green-900/30 border border-green-800/50'
            : 'bg-red-900/30 border border-red-800/50'
        }`}
      >
        <div className="flex items-center gap-3">
          {result.passed ? <PassIcon /> : <FailIcon />}
          <div>
            <p className={`font-medium ${result.passed ? 'text-green-300' : 'text-red-300'}`}>
              {result.passed ? 'Visual comparison passed' : 'Visual differences detected'}
            </p>
            <p className="text-xs text-gray-400">
              {result.diffPercentage.toFixed(2)}% pixels different (
              {result.diffPixelCount.toLocaleString()} / {result.totalPixels.toLocaleString()})
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Threshold: {result.threshold * 100}%</p>
          {!result.dimensionsMatch && (
            <p className="text-xs text-yellow-400">⚠️ Dimension mismatch</p>
          )}
        </div>
      </div>

      {/* Dimension Info */}
      {!result.dimensionsMatch && (
        <div className="mb-4 px-3 py-2 bg-yellow-900/20 border border-yellow-800/50 rounded text-sm">
          <span className="text-yellow-300">Dimensions differ: </span>
          <span className="text-gray-300">
            Baseline: {result.baselineDimensions.width}×{result.baselineDimensions.height}
          </span>
          <span className="text-gray-500 mx-2">→</span>
          <span className="text-gray-300">
            Actual: {result.actualDimensions.width}×{result.actualDimensions.height}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {(['side-by-side', 'overlay', 'diff'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                viewMode === mode ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {mode === 'side-by-side' && 'Side by Side'}
              {mode === 'overlay' && 'Overlay'}
              {mode === 'diff' && 'Diff Only'}
            </button>
          ))}
        </div>

        {/* Overlay Opacity Slider */}
        {viewMode === 'overlay' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Opacity:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="w-24 accent-primary-500"
            />
            <span className="text-xs text-gray-400 w-8">{Math.round(overlayOpacity * 100)}%</span>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="p-1.5 text-gray-400 hover:text-white bg-gray-800 rounded"
          >
            <MinusIcon />
          </button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1.5 text-gray-400 hover:text-white bg-gray-800 rounded"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="ml-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Image Comparison */}
      <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
        {viewMode === 'side-by-side' && (
          <div
            className="grid grid-cols-3 gap-1 p-2"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            <ImagePanel
              label="Baseline"
              image={baselineImage}
            />
            <ImagePanel
              label="Actual"
              image={actualImage}
            />
            <ImagePanel
              label="Diff"
              image={result.diffImage}
              highlight
            />
          </div>
        )}

        {viewMode === 'overlay' && (
          <div
            className="relative p-2"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {baselineImage && (
              <img
                src={baselineImage}
                alt="Baseline"
                className="max-w-full"
              />
            )}
            {actualImage && (
              <img
                src={actualImage}
                alt="Actual"
                className="absolute top-2 left-2 max-w-full"
                style={{ opacity: overlayOpacity }}
              />
            )}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-gray-900/80 px-2 py-1 rounded text-xs">
              <span className="text-gray-400">Baseline</span>
              <span className="text-gray-600">|</span>
              <span
                className="text-gray-400"
                style={{ opacity: overlayOpacity }}
              >
                Actual ({Math.round(overlayOpacity * 100)}%)
              </span>
            </div>
          </div>
        )}

        {viewMode === 'diff' && (
          <div
            className="p-2"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {result.diffImage ? (
              <div>
                <img
                  src={result.diffImage}
                  alt="Diff"
                  className="max-w-full"
                />
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-[#ff00ff] rounded-sm" />
                    <span>Changed pixels</span>
                  </div>
                  <span>
                    {result.diffPixelCount.toLocaleString()} pixels (
                    {result.diffPercentage.toFixed(2)}%)
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                <p className="text-sm">No diff image available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <StatCard
          label="Diff Pixels"
          value={result.diffPixelCount.toLocaleString()}
        />
        <StatCard
          label="Total Pixels"
          value={result.totalPixels.toLocaleString()}
        />
        <StatCard
          label="Diff %"
          value={`${result.diffPercentage.toFixed(2)}%`}
          highlight={!result.passed}
        />
        <StatCard
          label="Status"
          value={result.passed ? 'PASS' : 'FAIL'}
          highlight={!result.passed}
          positive={result.passed}
        />
      </div>
    </div>
  );
}

function ImagePanel({
  label,
  image,
  highlight,
}: {
  label: string;
  image?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded overflow-hidden ${highlight ? 'ring-2 ring-primary-500' : ''}`}>
      <div className="bg-gray-800 px-2 py-1 text-xs text-gray-400 font-medium">{label}</div>
      <div className="bg-gray-950">
        {image ? (
          <img
            src={image}
            alt={label}
            className="max-w-full"
          />
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-600 text-xs">
            No image
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`px-3 py-2 rounded border text-center ${
        highlight
          ? positive
            ? 'bg-green-900/30 text-green-300 border-green-800/50'
            : 'bg-red-900/30 text-red-300 border-red-800/50'
          : 'bg-gray-800 text-gray-300 border-gray-700'
      }`}
    >
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

function PassIcon() {
  return (
    <svg
      className="w-6 h-6 text-green-400"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FailIcon() {
  return (
    <svg
      className="w-6 h-6 text-red-400"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      className="w-12 h-12"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 12H4"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}
