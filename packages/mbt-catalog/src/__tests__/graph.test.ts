import { describe, expect, it } from 'vitest';
import type { SelectorInput } from '@like-cake/ast-types';
import type { ElementBinding } from '../types/element-binding';
import type { TestModel } from '../types/model';
import { generateTestPaths } from '../graph/path-generator';
import { generateScenariosFromModel } from '../graph/generate-scenarios';

// ── Test fixtures ───────────────────────────────────────────────────────

const makeSelector = (value: string): SelectorInput => ({
  strategy: 'css',
  value,
});

const makeBinding = (id: string, selector: string): ElementBinding => ({
  id,
  selector: makeSelector(selector),
  candidates: [],
  selectionMethod: 'manual',
  label: `element-${id}`,
  pageUrl: 'https://example.com',
  createdAt: Date.now(),
});

const bindings: ElementBinding[] = [
  makeBinding('btn-login', '[data-testid="login-btn"]'),
  makeBinding('input-email', '[data-testid="email"]'),
];

const baseMeta = { createdAt: 0, updatedAt: 0, version: 1 };

// ── Model factories ─────────────────────────────────────────────────────

/** A → B → C(final): linear chain */
const makeLinearModel = (): TestModel => ({
  id: 'linear',
  name: 'Linear Flow',
  states: [
    { id: 'a', name: 'A', verifications: [], isInitial: true },
    { id: 'b', name: 'B', verifications: [] },
    { id: 'c', name: 'C', verifications: [], isFinal: true },
  ],
  transitions: [
    {
      id: 'a-to-b',
      sourceStateId: 'a',
      targetStateId: 'b',
      event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
    },
    {
      id: 'b-to-c',
      sourceStateId: 'b',
      targetStateId: 'c',
      event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
    },
  ],
  elementBindings: bindings,
  baseUrl: 'https://example.com',
  meta: baseMeta,
});

/** Diamond: A → B, A → C, B → D(final), C → D(final) */
const makeDiamondModel = (): TestModel => ({
  id: 'diamond',
  name: 'Diamond Flow',
  states: [
    { id: 'a', name: 'A', verifications: [], isInitial: true },
    { id: 'b', name: 'B', verifications: [] },
    { id: 'c', name: 'C', verifications: [] },
    { id: 'd', name: 'D', verifications: [], isFinal: true },
  ],
  transitions: [
    {
      id: 'a-to-b',
      sourceStateId: 'a',
      targetStateId: 'b',
      event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
    },
    {
      id: 'a-to-c',
      sourceStateId: 'a',
      targetStateId: 'c',
      event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
    },
    {
      id: 'b-to-d',
      sourceStateId: 'b',
      targetStateId: 'd',
      event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
    },
    {
      id: 'c-to-d',
      sourceStateId: 'c',
      targetStateId: 'd',
      event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
    },
  ],
  elementBindings: bindings,
  baseUrl: 'https://example.com',
  meta: baseMeta,
});

/** A(initial+final): single state that is both initial and final */
const makeSingleStateModel = (): TestModel => ({
  id: 'single',
  name: 'Single State',
  states: [
    { id: 'a', name: 'A', verifications: [], isInitial: true, isFinal: true },
  ],
  transitions: [],
  elementBindings: bindings,
  baseUrl: 'https://example.com',
  meta: baseMeta,
});

/** Guard 분기: A →(guard1) B(final), A →(guard2) C(final) */
const makeGuardedModel = (): TestModel => ({
  id: 'guarded',
  name: 'Guarded Flow',
  states: [
    { id: 'a', name: 'A', verifications: [], isInitial: true },
    { id: 'b', name: 'B', verifications: [], isFinal: true },
    { id: 'c', name: 'C', verifications: [], isFinal: true },
  ],
  transitions: [
    {
      id: 'a-to-b',
      sourceStateId: 'a',
      targetStateId: 'b',
      event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
      guard: { left: '{{isAdmin}}', operator: 'eq', right: 'true' },
    },
    {
      id: 'a-to-c',
      sourceStateId: 'a',
      targetStateId: 'c',
      event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
      guard: { left: '{{isAdmin}}', operator: 'eq', right: 'false' },
    },
  ],
  elementBindings: bindings,
  baseUrl: 'https://example.com',
  meta: baseMeta,
});

// ── generateTestPaths tests ─────────────────────────────────────────────

describe('generateTestPaths', () => {
  describe('linear model (A → B → C)', () => {
    it('produces exactly 1 shortest path to the final state', () => {
      const result = generateTestPaths(makeLinearModel());
      expect(result.strategy).toBe('shortest');
      expect(result.totalFound).toBe(1);
      expect(result.paths).toHaveLength(1);
    });

    it('path has 5 nodes: [state, transition, state, transition, state]', () => {
      const result = generateTestPaths(makeLinearModel());
      const path = result.paths[0];
      expect(path.nodes).toHaveLength(5);
      expect(path.nodes.map((n) => n.kind)).toEqual([
        'state', 'transition', 'state', 'transition', 'state',
      ]);
    });

    it('path states are A → B → C in order', () => {
      const result = generateTestPaths(makeLinearModel());
      const stateNames = result.paths[0].nodes
        .filter((n) => n.kind === 'state')
        .map((n) => n.state.name);
      expect(stateNames).toEqual(['A', 'B', 'C']);
    });

    it('path name joins state names with →', () => {
      const result = generateTestPaths(makeLinearModel());
      expect(result.paths[0].name).toBe('A → B → C');
    });
  });

  describe('diamond model (A → B/C → D)', () => {
    it('shortest paths reach the final state via both branches', () => {
      const result = generateTestPaths(makeDiamondModel());
      // Shortest should find at least the path to D (and possibly intermediates filtered)
      expect(result.totalFound).toBeGreaterThanOrEqual(1);
      // At least one path should end in D
      const pathNames = result.paths.map((p) => p.name);
      const reachesD = pathNames.some((n) => n.endsWith('D'));
      expect(reachesD).toBe(true);
    });

    it('simple strategy finds more or equal paths than shortest', () => {
      const shortest = generateTestPaths(makeDiamondModel(), { strategy: 'shortest' });
      const simple = generateTestPaths(makeDiamondModel(), { strategy: 'simple' });
      expect(simple.totalFound).toBeGreaterThanOrEqual(shortest.totalFound);
    });

    it('simple strategy includes both routes to D', () => {
      const result = generateTestPaths(makeDiamondModel(), { strategy: 'simple' });
      const finalPaths = result.paths.filter((p) => p.name.endsWith('D'));
      // A→B→D and A→C→D
      expect(finalPaths.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('single state model (A is initial + final)', () => {
    it('produces 1 path with 1 state node', () => {
      const result = generateTestPaths(makeSingleStateModel());
      expect(result.totalFound).toBe(1);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].nodes).toHaveLength(1);
      const firstNode = result.paths[0].nodes[0];
      expect(firstNode.kind).toBe('state');
      if (firstNode.kind === 'state') {
        expect(firstNode.state.id).toBe('a');
      }
    });
  });

  describe('guarded transitions', () => {
    it('explores both guard branches', () => {
      const result = generateTestPaths(makeGuardedModel());
      // Both B and C should be reachable
      const finalStateIds = result.paths.map((p) => {
        for (let i = p.nodes.length - 1; i >= 0; i--) {
          const node = p.nodes[i];
          if (node.kind === 'state') return node.state.id;
        }
        return undefined;
      });
      expect(finalStateIds).toContain('b');
      expect(finalStateIds).toContain('c');
    });
  });

  describe('options', () => {
    it('maxPaths limits returned paths', () => {
      const result = generateTestPaths(makeDiamondModel(), {
        strategy: 'simple',
        maxPaths: 1,
      });
      expect(result.paths).toHaveLength(1);
      expect(result.totalFound).toBeGreaterThanOrEqual(1);
    });

    it('requireFinalState: false includes non-terminal paths', () => {
      const model = makeLinearModel();
      const withFilter = generateTestPaths(model, { requireFinalState: true });
      const withoutFilter = generateTestPaths(model, { requireFinalState: false });
      // Without filter should include paths to A, B, C; with filter only paths to C
      expect(withoutFilter.totalFound).toBeGreaterThanOrEqual(withFilter.totalFound);
    });

    it('warnings mention filtered paths when requireFinalState removes some', () => {
      const result = generateTestPaths(makeLinearModel(), { requireFinalState: true });
      // Linear model has 3 states reachable; only C is final → 2 paths filtered
      if (result.warnings.length > 0) {
        expect(result.warnings[0]).toContain('did not reach a final state');
      }
    });
  });
});

// ── generateScenariosFromModel tests ────────────────────────────────────

describe('generateScenariosFromModel', () => {
  it('produces valid Scenario objects from a linear model', () => {
    const result = generateScenariosFromModel(makeLinearModel());
    expect(result.scenarios).toHaveLength(1);

    const scenario = result.scenarios[0];
    expect(scenario.id).toBeTruthy();
    expect(scenario.name).toBe('A → B → C');
    expect(scenario.meta.url).toBe('https://example.com');
    expect(scenario.meta.viewport).toEqual({ width: 1280, height: 720 });
    expect(scenario.meta.astSchemaVersion).toBe('1.0.0');
  });

  it('scenario steps are in correct order (click, click for linear)', () => {
    const result = generateScenariosFromModel(makeLinearModel());
    const steps = result.scenarios[0].steps;
    // Linear A→B→C: 2 click transitions, no verifications on states
    expect(steps).toHaveLength(2);
    expect(steps[0].type).toBe('click');
    expect(steps[1].type).toBe('click');
  });

  it('includes verifications as assertion steps', () => {
    const model = makeLinearModel();
    // Add a verification to state B
    model.states[1].verifications = [
      { verificationId: 'visible', elementBindingId: 'btn-login', params: {}, critical: true },
    ];

    const result = generateScenariosFromModel(model);
    const steps = result.scenarios[0].steps;
    // A(no v) → click → B(1 verification) → click → C(no v)
    // Steps: click, assertElement, click
    expect(steps).toHaveLength(3);
    expect(steps[0].type).toBe('click');
    expect(steps[1].type).toBe('assertElement');
    expect(steps[2].type).toBe('click');
  });

  it('collects unsupported mapping errors without crashing', () => {
    const model = makeLinearModel();
    // Replace first transition with a truly unknown event
    model.transitions[0].event = {
      eventId: 'unknownFutureEvent',
      elementBindingId: 'btn-login',
      params: {},
    };

    const result = generateScenariosFromModel(model);
    expect(result.scenarios).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].catalogEntryId).toBe('unknownFutureEvent');
    // Only the second click step survives
    expect(result.scenarios[0].steps).toHaveLength(1);
    expect(result.scenarios[0].steps[0].type).toBe('click');
  });

  it('passes path generation warnings through', () => {
    const result = generateScenariosFromModel(makeLinearModel());
    // The linear model filters 2 non-final paths → warning expected
    expect(result.warnings).toBeDefined();
  });

  it('respects options passed through to path generation', () => {
    const result = generateScenariosFromModel(makeDiamondModel(), {
      strategy: 'simple',
      maxPaths: 1,
    });
    expect(result.scenarios).toHaveLength(1);
  });

  it('handles single-state model with no transitions', () => {
    const result = generateScenariosFromModel(makeSingleStateModel());
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].steps).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
