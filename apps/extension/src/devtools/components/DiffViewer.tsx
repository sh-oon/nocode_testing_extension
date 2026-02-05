import { useState } from 'react';
import type { ComparisonResult } from '@like-cake/diff-engine';
import { ApiDiffPanel } from './ApiDiffPanel';
import { DomDiffPanel } from './DomDiffPanel';
import { VisualDiffPanel } from './VisualDiffPanel';

type DiffTab = 'api' | 'dom' | 'visual';

interface DiffViewerProps {
  result: ComparisonResult | null;
  isLoading?: boolean;
}

export function DiffViewer({ result, isLoading = false }: DiffViewerProps) {
  const [activeTab, setActiveTab] = useState<DiffTab>('api');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner />
          <span className="text-sm text-gray-400">Comparing results...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <CompareIcon />
        <p className="mt-2 text-sm">No comparison results yet</p>
        <p className="text-xs text-gray-600 mt-1">Run a playback to see diff results</p>
      </div>
    );
  }

  const tabs: Array<{ id: DiffTab; label: string; count: number; passed: boolean | undefined }> = [
    {
      id: 'api',
      label: 'API',
      count: result.api?.totalDiffs ?? 0,
      passed: result.api?.passed,
    },
    {
      id: 'dom',
      label: 'DOM',
      count: result.dom?.totalDiffs ?? 0,
      passed: result.dom?.passed,
    },
    {
      id: 'visual',
      label: 'Visual',
      count: result.visual ? (result.visual.passed ? 0 : 1) : 0,
      passed: result.visual?.passed,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Overall Status */}
      <div
        className={`px-4 py-2 flex items-center justify-between ${
          result.passed
            ? 'bg-green-900/30 border-b border-green-800'
            : 'bg-red-900/30 border-b border-red-800'
        }`}
      >
        <div className="flex items-center gap-2">
          {result.passed ? <PassIcon /> : <FailIcon />}
          <span className={`font-medium ${result.passed ? 'text-green-300' : 'text-red-300'}`}>
            {result.passed ? 'All comparisons passed' : 'Differences detected'}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(result.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.passed !== undefined && (
              <span
                className={`px-1.5 py-0.5 text-xs rounded-full ${
                  tab.passed
                    ? 'bg-green-900/50 text-green-300'
                    : tab.count > 0
                      ? 'bg-red-900/50 text-red-300'
                      : 'bg-gray-700 text-gray-400'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'api' && <ApiDiffPanel result={result.api} />}
        {activeTab === 'dom' && <DomDiffPanel result={result.dom} />}
        {activeTab === 'visual' && <VisualDiffPanel result={result.visual} />}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="w-8 h-8 animate-spin text-primary-400"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CompareIcon() {
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
        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
      />
    </svg>
  );
}

function PassIcon() {
  return (
    <svg
      className="w-5 h-5 text-green-400"
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
      className="w-5 h-5 text-red-400"
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
