interface TabToggleProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  tabs: Array<{ value: T; label: string }>;
}

export function TabToggle<T extends string>({ value, onChange, tabs }: TabToggleProps<T>) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === tab.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
