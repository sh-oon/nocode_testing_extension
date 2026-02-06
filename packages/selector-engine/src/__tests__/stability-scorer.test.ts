import { describe, expect, it } from 'vitest';
import type { SelectorCandidate } from '@like-cake/ast-types';
import { calculateStabilityScore, rankByStability } from '../utils/stability-scorer';

/**
 * Helper to create a selector candidate with default values
 */
function createCandidate(
  overrides: Partial<SelectorCandidate>
): SelectorCandidate {
  return {
    strategy: 'css',
    selector: '.btn',
    score: 0,
    isUnique: false,
    isReadable: false,
    confidence: 80,
    ...overrides,
  };
}

describe('calculateStabilityScore', () => {
  describe('Base strategy scores', () => {
    it('should return 95 for testId strategy', () => {
      const candidate = createCandidate({
        strategy: 'testId',
        selector: '[data-testid="submit"]',
      });
      expect(calculateStabilityScore(candidate)).toBe(95);
    });

    it('should return 85 for ariaLabel strategy', () => {
      const candidate = createCandidate({
        strategy: 'ariaLabel',
        selector: '[aria-label="Submit Form"]',
      });
      expect(calculateStabilityScore(candidate)).toBe(85);
    });

    it('should return 80 for role strategy', () => {
      const candidate = createCandidate({
        strategy: 'role',
        selector: 'button[role="button"]',
      });
      expect(calculateStabilityScore(candidate)).toBe(80);
    });

    it('should return 70 for text strategy', () => {
      const candidate = createCandidate({
        strategy: 'text',
        selector: 'button:contains("Submit")',
      });
      expect(calculateStabilityScore(candidate)).toBe(70);
    });

    it('should return 65 for id strategy', () => {
      const candidate = createCandidate({
        strategy: 'id',
        selector: '#submit-button',
      });
      expect(calculateStabilityScore(candidate)).toBe(65);
    });

    it('should return 60 for name strategy', () => {
      const candidate = createCandidate({
        strategy: 'name',
        selector: '[name="email"]',
      });
      expect(calculateStabilityScore(candidate)).toBe(60);
    });

    it('should return 40 for class strategy', () => {
      const candidate = createCandidate({
        strategy: 'class',
        selector: '.btn-primary',
      });
      expect(calculateStabilityScore(candidate)).toBe(40);
    });

    it('should return 30 for css strategy', () => {
      const candidate = createCandidate({
        strategy: 'css',
        selector: 'div > button',
      });
      expect(calculateStabilityScore(candidate)).toBe(30);
    });

    it('should return 20 for xpath strategy', () => {
      const candidate = createCandidate({
        strategy: 'xpath',
        selector: '//button[@id="submit"]',
      });
      expect(calculateStabilityScore(candidate)).toBe(20);
    });

    it('should return 0 for unknown strategy', () => {
      const candidate = createCandidate({
        strategy: 'unknown',
        selector: 'some-selector',
      });
      expect(calculateStabilityScore(candidate)).toBe(0);
    });
  });

  describe('Unique bonus', () => {
    it('should add +5 when isUnique is true', () => {
      const notUnique = createCandidate({
        strategy: 'css',
        selector: '.btn',
        isUnique: false,
      });

      const unique = createCandidate({
        strategy: 'css',
        selector: '.btn',
        isUnique: true,
      });

      expect(calculateStabilityScore(unique)).toBe(calculateStabilityScore(notUnique) + 5);
    });

    it('should not add bonus when isUnique is false', () => {
      const candidate = createCandidate({
        strategy: 'css',
        selector: '.btn',
        isUnique: false,
      });

      expect(calculateStabilityScore(candidate)).toBe(30);
    });
  });

  describe('Readable bonus', () => {
    it('should add +5 when isReadable is true', () => {
      const notReadable = createCandidate({
        strategy: 'css',
        selector: '.a1b2c3',
        isReadable: false,
      });

      const readable = createCandidate({
        strategy: 'css',
        selector: '.btn-primary',
        isReadable: true,
      });

      expect(calculateStabilityScore(readable)).toBe(calculateStabilityScore(notReadable) + 5);
    });

    it('should not add bonus when isReadable is false', () => {
      const candidate = createCandidate({
        strategy: 'css',
        selector: '.btn',
        isReadable: false,
      });

      expect(calculateStabilityScore(candidate)).toBe(30);
    });
  });

  describe('nth-child penalty', () => {
    it('should subtract -20 when selector contains :nth-child', () => {
      const withNthChild = createCandidate({
        strategy: 'css',
        selector: 'li:nth-child(3)',
      });

      const without = createCandidate({
        strategy: 'css',
        selector: 'li',
      });

      expect(calculateStabilityScore(withNthChild)).toBe(calculateStabilityScore(without) - 20);
    });

    it('should apply penalty for :nth-child with formula', () => {
      const candidate = createCandidate({
        strategy: 'css',
        selector: 'div:nth-child(2n+1)',
      });

      // Base score 30 - 20 penalty = 10
      expect(calculateStabilityScore(candidate)).toBe(10);
    });

    it('should not apply penalty when :nth-child is not present', () => {
      const candidate = createCandidate({
        strategy: 'css',
        selector: '.btn-nth-test',
      });

      expect(calculateStabilityScore(candidate)).toBe(30);
    });
  });

  describe('nth-of-type penalty', () => {
    it('should subtract -15 when selector contains :nth-of-type', () => {
      const withNthOfType = createCandidate({
        strategy: 'css',
        selector: 'button:nth-of-type(2)',
      });

      const without = createCandidate({
        strategy: 'css',
        selector: 'button',
      });

      expect(calculateStabilityScore(withNthOfType)).toBe(calculateStabilityScore(without) - 15);
    });

    it('should not apply penalty when :nth-of-type is not present', () => {
      const candidate = createCandidate({
        strategy: 'css',
        selector: 'button',
      });

      expect(calculateStabilityScore(candidate)).toBe(30);
    });
  });

  describe('Deep chain penalty', () => {
    it('should subtract -15 when selector has >3 levels', () => {
      // 4 levels: a > b > c > d (3 separators)
      const fourLevels = createCandidate({
        strategy: 'css',
        selector: 'div > section > article > p',
      });

      // Base score 30 - 15 penalty = 15
      expect(calculateStabilityScore(fourLevels)).toBe(15);
    });

    it('should subtract additional -10 when selector has >5 levels', () => {
      // 6 levels: a > b > c > d > e > f (5 separators)
      const sixLevels = createCandidate({
        strategy: 'css',
        selector: 'div > section > article > div > p > span',
      });

      // Base score 30 - 15 (>3) - 10 (>5) = 5
      expect(calculateStabilityScore(sixLevels)).toBe(5);
    });

    it('should not apply penalty when selector has <=3 levels', () => {
      const threeLevels = createCandidate({
        strategy: 'css',
        selector: 'div > section > article',
      });

      // Base score 30, no penalty
      expect(calculateStabilityScore(threeLevels)).toBe(30);
    });

    it('should not apply penalty for single level selector', () => {
      const singleLevel = createCandidate({
        strategy: 'css',
        selector: 'button',
      });

      expect(calculateStabilityScore(singleLevel)).toBe(30);
    });
  });

  describe('Class count penalty', () => {
    it('should subtract -10 when selector has >2 class selectors', () => {
      const threeClasses = createCandidate({
        strategy: 'css',
        selector: '.btn.btn-primary.btn-lg',
      });

      // Base score 30 - 10 penalty = 20
      expect(calculateStabilityScore(threeClasses)).toBe(20);
    });

    it('should not apply penalty when selector has <=2 classes', () => {
      const twoClasses = createCandidate({
        strategy: 'css',
        selector: '.btn.btn-primary',
      });

      expect(calculateStabilityScore(twoClasses)).toBe(30);
    });

    it('should not apply penalty for single class', () => {
      const oneClass = createCandidate({
        strategy: 'css',
        selector: '.btn',
      });

      expect(calculateStabilityScore(oneClass)).toBe(30);
    });

    it('should not apply penalty when no classes present', () => {
      const noClasses = createCandidate({
        strategy: 'css',
        selector: 'button',
      });

      expect(calculateStabilityScore(noClasses)).toBe(30);
    });
  });

  describe('Combined penalties and bonuses', () => {
    it('should apply multiple bonuses', () => {
      const candidate = createCandidate({
        strategy: 'testId',
        selector: '[data-testid="submit"]',
        isUnique: true,
        isReadable: true,
      });

      // Base 95 + 5 (unique) + 5 (readable) = 105, clamped to 100
      expect(calculateStabilityScore(candidate)).toBe(100);
    });

    it('should apply multiple penalties', () => {
      const candidate = createCandidate({
        strategy: 'css',
        selector: 'div > section > article > div > p > span:nth-child(2).btn.btn-primary.btn-lg',
      });

      // Base 30 - 20 (nth-child) - 15 (>3 levels) - 10 (>5 levels) - 10 (>2 classes) = -25, clamped to 0
      expect(calculateStabilityScore(candidate)).toBe(0);
    });

    it('should apply both bonuses and penalties', () => {
      const candidate = createCandidate({
        strategy: 'role',
        selector: 'button[role="button"]:nth-child(2)',
        isUnique: true,
        isReadable: true,
      });

      // Base 80 + 5 (unique) + 5 (readable) - 20 (nth-child) = 70
      expect(calculateStabilityScore(candidate)).toBe(70);
    });
  });

  describe('Score clamping', () => {
    it('should clamp score to maximum of 100', () => {
      const candidate = createCandidate({
        strategy: 'testId',
        selector: '[data-testid="test"]',
        isUnique: true,
        isReadable: true,
      });

      // Would be 105 (95 + 5 + 5), but clamped to 100
      expect(calculateStabilityScore(candidate)).toBe(100);
    });

    it('should clamp score to minimum of 0', () => {
      const candidate = createCandidate({
        strategy: 'xpath',
        selector: '//div/div/div/div/div/div:nth-child(1).a.b.c',
        isUnique: false,
        isReadable: false,
      });

      // Would be negative, but clamped to 0
      expect(calculateStabilityScore(candidate)).toBe(0);
    });

    it('should not clamp scores within valid range', () => {
      const candidate = createCandidate({
        strategy: 'role',
        selector: 'button[role="button"]',
        isUnique: false,
        isReadable: false,
      });

      expect(calculateStabilityScore(candidate)).toBe(80);
    });
  });
});

describe('rankByStability', () => {
  it('should return candidates sorted by stability score descending', () => {
    const candidates: SelectorCandidate[] = [
      createCandidate({
        strategy: 'xpath',
        selector: '//button',
      }), // Score: 20
      createCandidate({
        strategy: 'testId',
        selector: '[data-testid="btn"]',
        isUnique: true,
      }), // Score: 100 (95 + 5)
      createCandidate({
        strategy: 'css',
        selector: '.btn',
      }), // Score: 30
      createCandidate({
        strategy: 'role',
        selector: 'button[role="button"]',
      }), // Score: 80
    ];

    const ranked = rankByStability(candidates);

    expect(ranked).toHaveLength(4);
    expect(ranked[0].strategy).toBe('testId');
    expect(calculateStabilityScore(ranked[0])).toBe(100);
    expect(ranked[1].strategy).toBe('role');
    expect(calculateStabilityScore(ranked[1])).toBe(80);
    expect(ranked[2].strategy).toBe('css');
    expect(calculateStabilityScore(ranked[2])).toBe(30);
    expect(ranked[3].strategy).toBe('xpath');
    expect(calculateStabilityScore(ranked[3])).toBe(20);
  });

  it('should not mutate original array', () => {
    const candidates: SelectorCandidate[] = [
      createCandidate({
        strategy: 'css',
        selector: '.btn',
      }),
      createCandidate({
        strategy: 'testId',
        selector: '[data-testid="btn"]',
      }),
    ];

    const originalOrder = [...candidates];
    const ranked = rankByStability(candidates);

    // Original array should be unchanged
    expect(candidates).toEqual(originalOrder);
    expect(candidates[0]).toBe(originalOrder[0]);
    expect(candidates[1]).toBe(originalOrder[1]);

    // Ranked array should be different
    expect(ranked).not.toBe(candidates);
    expect(ranked[0].strategy).toBe('testId');
  });

  it('should handle empty array', () => {
    const candidates: SelectorCandidate[] = [];
    const ranked = rankByStability(candidates);

    expect(ranked).toEqual([]);
    expect(ranked).toHaveLength(0);
  });

  it('should handle single candidate', () => {
    const candidates: SelectorCandidate[] = [
      createCandidate({
        strategy: 'testId',
        selector: '[data-testid="btn"]',
      }),
    ];

    const ranked = rankByStability(candidates);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toEqual(candidates[0]);
  });

  it('should maintain stable sort for equal scores', () => {
    const candidates: SelectorCandidate[] = [
      createCandidate({
        strategy: 'css',
        selector: '.btn-a',
      }),
      createCandidate({
        strategy: 'css',
        selector: '.btn-b',
      }),
      createCandidate({
        strategy: 'css',
        selector: '.btn-c',
      }),
    ];

    const ranked = rankByStability(candidates);

    // All have same score (30), order should be preserved
    expect(ranked[0].selector).toBe('.btn-a');
    expect(ranked[1].selector).toBe('.btn-b');
    expect(ranked[2].selector).toBe('.btn-c');
  });

  it('should handle candidates with complex penalties', () => {
    const candidates: SelectorCandidate[] = [
      createCandidate({
        strategy: 'css',
        selector: 'div > section > article > div:nth-child(1)',
        isUnique: true,
      }), // 30 + 5 - 20 - 15 = 0
      createCandidate({
        strategy: 'css',
        selector: '.btn.btn-primary.btn-lg',
      }), // 30 - 10 = 20
      createCandidate({
        strategy: 'ariaLabel',
        selector: '[aria-label="Submit"]',
        isUnique: true,
        isReadable: true,
      }), // 85 + 5 + 5 = 95
    ];

    const ranked = rankByStability(candidates);

    expect(calculateStabilityScore(ranked[0])).toBe(95);
    expect(calculateStabilityScore(ranked[1])).toBe(20);
    expect(calculateStabilityScore(ranked[2])).toBe(0);
  });

  it('should handle all same strategy with different modifiers', () => {
    const candidates: SelectorCandidate[] = [
      createCandidate({
        strategy: 'testId',
        selector: '[data-testid="btn1"]',
        isUnique: false,
        isReadable: false,
      }), // 95
      createCandidate({
        strategy: 'testId',
        selector: '[data-testid="btn2"]',
        isUnique: true,
        isReadable: false,
      }), // 100
      createCandidate({
        strategy: 'testId',
        selector: '[data-testid="btn3"]',
        isUnique: false,
        isReadable: true,
      }), // 100
      createCandidate({
        strategy: 'testId',
        selector: '[data-testid="btn4"]',
        isUnique: true,
        isReadable: true,
      }), // 100 (clamped)
    ];

    const ranked = rankByStability(candidates);

    // All with bonuses should be 100, last one should be 95
    expect(calculateStabilityScore(ranked[0])).toBe(100);
    expect(calculateStabilityScore(ranked[1])).toBe(100);
    expect(calculateStabilityScore(ranked[2])).toBe(100);
    expect(calculateStabilityScore(ranked[3])).toBe(95);
  });
});
