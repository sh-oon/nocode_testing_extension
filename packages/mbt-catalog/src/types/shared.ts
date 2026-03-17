/**
 * Shared types for MBT catalog entries
 *
 * CatalogParamDef drives UI rendering of parameter forms.
 * ElementRequirement signals whether a catalog entry needs DOM element binding.
 */

/** UI 렌더링을 위한 파라미터 정의 */
export interface CatalogParamDef {
  /** Parameter identifier */
  name: string;
  /** Display label for UI */
  label: string;
  /** Input control type */
  type: 'string' | 'number' | 'boolean' | 'select' | 'key' | 'file' | 'position';
  /** Whether the parameter must be provided */
  required: boolean;
  /** Default value when not specified */
  defaultValue?: unknown;
  /** Options for 'select' type */
  options?: Array<{ label: string; value: string }>;
  /** Placeholder text for input controls */
  placeholder?: string;
}

/** Whether a catalog entry requires a DOM element binding */
export type ElementRequirement = 'required' | 'optional' | 'none';
