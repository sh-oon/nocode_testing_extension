import type { CatalogParamDef } from '@like-cake/mbt-catalog';

interface CatalogParamFormProps {
  params: CatalogParamDef[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function CatalogParamForm({ params, values, onChange }: CatalogParamFormProps) {
  if (params.length === 0) {
    return <div className="text-xs text-gray-500 py-1">파라미터 없음</div>;
  }

  const handleChange = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  return (
    <div className="space-y-3">
      {params.map((param) => {
        const currentValue = values[param.name] ?? param.defaultValue ?? '';

        return (
          <div key={param.name}>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              {param.label}
              {param.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>

            {param.type === 'string' && (
              <input
                type="text"
                value={String(currentValue)}
                onChange={(e) => handleChange(param.name, e.target.value)}
                placeholder={param.placeholder}
                className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            )}

            {param.type === 'number' && (
              <input
                type="number"
                value={currentValue === '' ? '' : Number(currentValue)}
                onChange={(e) => handleChange(param.name, e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={param.placeholder}
                className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            )}

            {param.type === 'boolean' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(currentValue)}
                  onChange={(e) => handleChange(param.name, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-800"
                />
                <span className="text-sm text-gray-300">
                  {Boolean(currentValue) ? '활성화' : '비활성화'}
                </span>
              </label>
            )}

            {param.type === 'select' && (
              <select
                value={String(currentValue)}
                onChange={(e) => handleChange(param.name, e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-orange-500"
              >
                {!param.required && <option value="">선택 안 함</option>}
                {param.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {param.type === 'key' && (
              <input
                type="text"
                value={String(currentValue)}
                onChange={(e) => handleChange(param.name, e.target.value)}
                placeholder={param.placeholder || 'Enter, Escape, Tab...'}
                className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white font-mono placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            )}

            {param.type === 'file' && (
              <input
                type="text"
                value={String(currentValue)}
                onChange={(e) => handleChange(param.name, e.target.value)}
                placeholder={param.placeholder || '파일 경로'}
                className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white font-mono placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            )}

            {param.type === 'position' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 mb-0.5">X</label>
                  <input
                    type="number"
                    value={typeof currentValue === 'object' && currentValue !== null ? ((currentValue as Record<string, number>).x ?? 0) : 0}
                    onChange={(e) => {
                      const current = typeof currentValue === 'object' && currentValue !== null ? currentValue as Record<string, number> : { x: 0, y: 0 };
                      handleChange(param.name, { ...current, x: Number(e.target.value) });
                    }}
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 mb-0.5">Y</label>
                  <input
                    type="number"
                    value={typeof currentValue === 'object' && currentValue !== null ? ((currentValue as Record<string, number>).y ?? 0) : 0}
                    onChange={(e) => {
                      const current = typeof currentValue === 'object' && currentValue !== null ? currentValue as Record<string, number> : { x: 0, y: 0 };
                      handleChange(param.name, { ...current, y: Number(e.target.value) });
                    }}
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
