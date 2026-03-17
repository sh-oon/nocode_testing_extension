import type { SelectorInput } from '@like-cake/ast-types';

/** Convert a SelectorInput (string or Selector object) to a display string */
export const selectorToString = (selector: SelectorInput): string => {
  if (typeof selector === 'string') return selector;
  switch (selector.strategy) {
    case 'testId':
    case 'css':
    case 'xpath':
      return selector.value;
    case 'role':
      return `role=${selector.role}${selector.name ? `[${selector.name}]` : ''}`;
    default:
      return 'selector';
  }
};
