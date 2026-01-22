import { describe, expect, it } from 'vitest';
import type { SelectorResult } from '../types';
import {
  calculateCompositeScore,
  compareSelectorResults,
  rankSelectorResults,
} from '../utils/scorer';
import {
  isSelectorStable,
  validateSelector,
  validateSelectorObject,
  validateSelectorString,
} from '../utils/validator';

describe('Scorer', () => {
  describe('calculateCompositeScore', () => {
    it('should score testId highest', () => {
      const testIdResult: SelectorResult = {
        selector: { strategy: 'testId', value: 'submit-btn' },
        score: 100,
        isUnique: true,
        description: 'Test ID',
      };

      const cssResult: SelectorResult = {
        selector: { strategy: 'css', value: '.btn-primary' },
        score: 70,
        isUnique: false,
        description: 'CSS',
      };

      const testIdScore = calculateCompositeScore(testIdResult);
      const cssScore = calculateCompositeScore(cssResult);

      expect(testIdScore).toBeGreaterThan(cssScore);
    });

    it('should favor unique selectors', () => {
      const unique: SelectorResult = {
        selector: { strategy: 'css', value: '#submit' },
        score: 90,
        isUnique: true,
        description: 'ID selector',
      };

      const notUnique: SelectorResult = {
        selector: { strategy: 'css', value: '.btn' },
        score: 90,
        isUnique: false,
        description: 'Class selector',
      };

      expect(calculateCompositeScore(unique)).toBeGreaterThan(calculateCompositeScore(notUnique));
    });

    it('should favor shorter selectors', () => {
      const short: SelectorResult = {
        selector: { strategy: 'css', value: '#btn' },
        score: 80,
        isUnique: true,
        description: 'Short',
      };

      const long: SelectorResult = {
        selector: {
          strategy: 'css',
          value: '.container .row .col-md-6 .card .card-body .btn-primary',
        },
        score: 80,
        isUnique: true,
        description: 'Long',
      };

      expect(calculateCompositeScore(short)).toBeGreaterThan(calculateCompositeScore(long));
    });
  });

  describe('compareSelectorResults', () => {
    it('should return the better selector', () => {
      const better: SelectorResult = {
        selector: { strategy: 'testId', value: 'btn' },
        score: 100,
        isUnique: true,
        description: 'TestID',
      };

      const worse: SelectorResult = {
        selector: { strategy: 'xpath', value: '//button[1]' },
        score: 40,
        isUnique: false,
        description: 'XPath',
      };

      expect(compareSelectorResults(better, worse)).toBe(better);
      expect(compareSelectorResults(worse, better)).toBe(better);
    });
  });

  describe('rankSelectorResults', () => {
    it('should rank selectors from best to worst', () => {
      const results: SelectorResult[] = [
        {
          selector: { strategy: 'xpath', value: '//button' },
          score: 40,
          isUnique: false,
          description: 'XPath',
        },
        {
          selector: { strategy: 'testId', value: 'btn' },
          score: 100,
          isUnique: true,
          description: 'TestID',
        },
        {
          selector: { strategy: 'css', value: '.btn' },
          score: 70,
          isUnique: false,
          description: 'CSS',
        },
      ];

      const ranked = rankSelectorResults(results);

      expect(ranked[0].selector.strategy).toBe('testId');
      expect(ranked[ranked.length - 1].selector.strategy).toBe('xpath');
    });
  });
});

describe('Validator', () => {
  describe('validateSelectorString', () => {
    it('should validate empty strings as invalid', () => {
      const result = validateSelectorString('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should detect undefined/null in selector', () => {
      const result = validateSelectorString('[data-id="undefined"]');
      expect(result.isValid).toBe(false);
    });

    it('should warn about long numeric sequences', () => {
      const result = validateSelectorString('[data-id="123456789"]');
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about positional selectors', () => {
      const result = validateSelectorString('li:nth-child(5)');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Positional selector without unique identifier (may be fragile)'
      );
    });

    it('should warn about deep chains', () => {
      const result = validateSelectorString('a > b > c > d > e > f');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Deep descendant chain (may break with DOM changes)');
    });

    it('should validate balanced brackets', () => {
      expect(validateSelectorString('[data-id="test"]').isValid).toBe(true);
      expect(validateSelectorString('[data-id="test"').isValid).toBe(false);
    });
  });

  describe('validateSelectorObject', () => {
    it('should validate testId selector', () => {
      const result = validateSelectorObject({
        strategy: 'testId',
        value: 'submit-btn',
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject testId with whitespace', () => {
      const result = validateSelectorObject({
        strategy: 'testId',
        value: 'submit btn',
      });
      expect(result.isValid).toBe(false);
    });

    it('should validate role selector', () => {
      const result = validateSelectorObject({
        strategy: 'role',
        value: 'button[name="Submit"]',
        role: 'button',
      });
      expect(result.isValid).toBe(true);
    });

    it('should warn about unknown roles', () => {
      const result = validateSelectorObject({
        strategy: 'role',
        value: 'unknown-role',
        role: 'unknownrole',
      });
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate XPath selector', () => {
      const result = validateSelectorObject({
        strategy: 'xpath',
        value: '//button[@id="submit"]',
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject XPath not starting with /', () => {
      const result = validateSelectorObject({
        strategy: 'xpath',
        value: 'button[@id="submit"]',
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateSelector', () => {
    it('should handle string selectors', () => {
      const result = validateSelector('.btn-primary');
      expect(result.isValid).toBe(true);
    });

    it('should handle object selectors', () => {
      const result = validateSelector({
        strategy: 'testId',
        value: 'submit',
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('isSelectorStable', () => {
    it('should return true for stable selectors', () => {
      expect(isSelectorStable('[data-testid="submit"]')).toBe(true);
      expect(isSelectorStable({ strategy: 'testId', value: 'submit' })).toBe(true);
    });

    it('should return false for fragile selectors', () => {
      // Positional selector without unique identifier
      expect(isSelectorStable('li:nth-child(5)')).toBe(false);
    });
  });
});
