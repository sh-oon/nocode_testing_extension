/**
 * Verification catalog entry type
 *
 * Each entry describes an assertion/check that can be performed on the page.
 * Verifications are checked at states in the model to confirm expected outcomes.
 */

import type { CatalogParamDef, ElementRequirement } from './shared';

/** Verification grouping categories */
export type VerificationCategory = 'element' | 'form' | 'content' | 'page' | 'api';

/** A single verification definition in the catalog */
export interface VerificationCatalogEntry {
  /** Unique identifier (e.g., 'visible', 'textContains', 'apiResponse') */
  id: string;
  /** UI display name */
  label: string;
  /** Tooltip / help text */
  description: string;
  /** Grouping category */
  category: VerificationCategory;
  /** Whether this verification requires a DOM element binding */
  elementRequirement: ElementRequirement;
  /** Configurable parameters for this verification */
  params: CatalogParamDef[];
  /** Mapping to existing ElementAssertion.type or 'assertApi' (null = new assertion needed) */
  mappedAssertionType: string | null;
  /** Search/filter tags */
  tags: string[];
}
