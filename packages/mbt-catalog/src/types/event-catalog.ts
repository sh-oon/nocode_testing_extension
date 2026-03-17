/**
 * Event catalog entry type
 *
 * Each entry describes a user interaction that can be performed during testing.
 * The catalog is the single source of truth for all supported events.
 */

import type { CatalogParamDef, ElementRequirement } from './shared';

/** Event grouping categories */
export type EventCategory = 'mouse' | 'keyboard' | 'form' | 'navigation' | 'timing';

/** A single event definition in the catalog */
export interface EventCatalogEntry {
  /** Unique identifier (e.g., 'click', 'type', 'navigate') */
  id: string;
  /** UI display name */
  label: string;
  /** Tooltip / help text */
  description: string;
  /** Grouping category */
  category: EventCategory;
  /** Whether this event requires a DOM element binding */
  elementRequirement: ElementRequirement;
  /** Configurable parameters for this event */
  params: CatalogParamDef[];
  /** Mapping to existing StepType (null = new executor needed) */
  mappedStepType: string | null;
  /** Search/filter tags */
  tags: string[];
}
