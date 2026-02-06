import type { ChangeEvent } from 'react';

export type SortOption = 'updatedAt' | 'name' | 'createdAt';

interface FlowSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const sortLabels: Record<SortOption, string> = {
  updatedAt: '최근 수정순',
  name: '이름순',
  createdAt: '생성일순',
};

export function FlowSearchBar({
  query,
  onQueryChange,
  sortBy,
  onSortChange,
}: FlowSearchBarProps) {
  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(e.target.value);
  };

  const handleSortChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value as SortOption);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
      {/* Search input */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
          <SearchIcon />
        </div>
        <label htmlFor="flow-search-input" className="sr-only">
          플로우 검색
        </label>
        <input
          id="flow-search-input"
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="플로우 검색..."
          className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          data-test-id="flow-search-input"
        />
      </div>

      {/* Sort dropdown */}
      <label htmlFor="flow-sort-select" className="sr-only">
        정렬 기준
      </label>
      <select
        id="flow-sort-select"
        value={sortBy}
        onChange={handleSortChange}
        className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-sm text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
        data-test-id="flow-sort-select"
      >
        {(Object.entries(sortLabels) as Array<[SortOption, string]>).map(
          ([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
