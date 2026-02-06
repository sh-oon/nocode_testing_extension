# No-Code UX 강화 기능 구현 계획

## 1. 개요

### 목표
사용자가 코드나 기술적 문법(JSONPath, CSS Selector, Regex)을 직접 작성하지 않고도 테스트를 완전히 관리할 수 있도록 UI를 강화합니다.

### 추가 기능
1. **JSONPath Picker**: API 응답을 트리 뷰어로 보여주고 클릭으로 경로 자동 생성
2. **Selector Recommender**: 녹화 시 다중 selector 수집 및 추천 UI
3. **Pattern Presets**: 정규식 대신 "contains", "starts with" 등 프리셋 제공

### 현재 상태
- 변수 추출: JSONPath 직접 입력 필요
- Selector: 자동 생성된 단일 selector 사용
- 조건 매칭: 정규식 직접 입력 필요

---

## 2. 기능별 상세 설계

### 2.1 JSONPath Picker

#### 목적
API 응답 JSON을 시각적으로 탐색하고, 원하는 값을 클릭하면 JSONPath가 자동 생성되는 UI

#### UI 디자인

```
┌─ Extract Variable ─────────────────────────────────────────────────┐
│                                                                     │
│  Variable Name: [userId                    ]                        │
│  Source:        [Last API Response      ▼]                         │
│                                                                     │
│  ┌─ Response Preview ─────────────────────────────────────────────┐│
│  │ ▼ data                                                          ││
│  │   ▼ user                                                        ││
│  │     ├─ id: 12345              [Click to select: $.data.user.id] ││
│  │     ├─ name: "John Doe"                                         ││
│  │     ├─ email: "john@example.com"                                ││
│  │     └─ ▼ roles                                                  ││
│  │         ├─ [0]: "admin"       [$.data.user.roles[0]]            ││
│  │         └─ [1]: "editor"                                        ││
│  │   ├─ token: "eyJhbG..."                                         ││
│  │   └─ expiresAt: 1699999999                                      ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  Selected Path: [$.data.user.id                      ] [Test ▶]    │
│  Preview Value: 12345                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 구현 파일

| 파일 | 설명 |
|------|------|
| `apps/extension/src/devtools/components/JsonTreeViewer/index.tsx` | 트리 뷰어 메인 컴포넌트 |
| `apps/extension/src/devtools/components/JsonTreeViewer/TreeNode.tsx` | 재귀적 노드 렌더링 |
| `apps/extension/src/devtools/components/JsonTreeViewer/PathBuilder.ts` | JSONPath 생성 유틸 |
| `apps/extension/src/devtools/components/FlowBuilder/editors/ExtractionEditor.tsx` | 기존 편집기에 통합 |

#### 핵심 로직

```typescript
// PathBuilder.ts
export function buildJsonPath(path: (string | number)[]): string {
  let result = '$';
  for (const segment of path) {
    if (typeof segment === 'number') {
      result += `[${segment}]`;
    } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) {
      result += `.${segment}`;
    } else {
      result += `['${segment}']`;
    }
  }
  return result;
}

// TreeNode.tsx - 클릭 핸들러
const handleNodeClick = (path: (string | number)[], value: unknown) => {
  const jsonPath = buildJsonPath(path);
  onSelect(jsonPath, value);
};
```

#### 데이터 흐름

```
1. 시나리오 실행 시 API 응답 저장
   └─ ExecutionService에서 apiCalls 수집
   └─ FlowExecutor에서 lastApiResponse 컨텍스트에 저장

2. ExtractionEditor 열 때 마지막 API 응답 로드
   └─ Backend API: GET /api/executions/:id/last-api-response

3. JsonTreeViewer에서 응답 렌더링
   └─ 노드 클릭 → JSONPath 생성 → 입력 필드에 자동 입력

4. "Test" 버튼으로 경로 검증
   └─ jsonpath-plus로 실제 값 추출 → Preview 표시
```

---

### 2.2 Selector Recommender

#### 목적
녹화 시 하나의 요소에 대해 여러 selector 전략을 수집하고, 사용자가 가장 안정적인 것을 선택할 수 있도록 함

#### UI 디자인

```
┌─ Edit Step: Click ──────────────────────────────────────────────────┐
│                                                                      │
│  Target Element:                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  <button class="btn btn-primary" data-testid="submit-btn">     │ │
│  │    Submit Order                                                 │ │
│  │  </button>                                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Select a Selector:                                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ◉ [data-testid="submit-btn"]                    ⭐ Recommended │ │
│  │   Stability: ████████░░ 85%  │  Unique: ✓  │  Readable: ✓      │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ ○ button[role="button"]:has-text("Submit Order")               │ │
│  │   Stability: ███████░░░ 70%  │  Unique: ✓  │  Readable: ✓      │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ ○ .btn.btn-primary                                              │ │
│  │   Stability: ████░░░░░░ 40%  │  Unique: ✗  │  Readable: ○      │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ ○ #app > div > form > button:nth-child(3)                      │ │
│  │   Stability: ██░░░░░░░░ 20%  │  Unique: ✓  │  Readable: ✗      │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ ○ Custom...                                                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [Highlight in Page]  [Test Selector]           [Cancel] [Save]     │
└──────────────────────────────────────────────────────────────────────┘
```

#### 구현 파일

| 파일 | 설명 |
|------|------|
| `packages/selector-engine/src/strategies/index.ts` | 다중 전략 수집 로직 (수정) |
| `packages/selector-engine/src/scorer.ts` | Selector 안정성 점수 계산 (신규) |
| `apps/extension/src/devtools/components/SelectorPicker/index.tsx` | Selector 선택 UI (신규) |
| `apps/extension/src/devtools/components/SelectorPicker/SelectorOption.tsx` | 개별 옵션 컴포넌트 |
| `apps/extension/src/content/highlight.ts` | 페이지 내 요소 하이라이트 |

#### Selector 전략 우선순위

```typescript
// selector-engine/src/strategies/index.ts
export const SELECTOR_STRATEGIES = [
  { name: 'testId', priority: 100, generator: generateTestIdSelector },
  { name: 'ariaLabel', priority: 90, generator: generateAriaSelector },
  { name: 'role', priority: 85, generator: generateRoleSelector },
  { name: 'text', priority: 80, generator: generateTextSelector },
  { name: 'id', priority: 75, generator: generateIdSelector },
  { name: 'name', priority: 70, generator: generateNameSelector },
  { name: 'class', priority: 50, generator: generateClassSelector },
  { name: 'css', priority: 30, generator: generateCssSelector },
  { name: 'xpath', priority: 10, generator: generateXPathSelector },
];

export interface SelectorCandidate {
  strategy: string;
  selector: string;
  score: number;
  isUnique: boolean;
  isReadable: boolean;
  confidence: number;
}
```

#### 안정성 점수 계산

```typescript
// selector-engine/src/scorer.ts
export function calculateStabilityScore(candidate: SelectorCandidate): number {
  let score = 0;

  // 전략별 기본 점수
  const strategyScores: Record<string, number> = {
    testId: 95,
    ariaLabel: 85,
    role: 80,
    text: 70,
    id: 65,      // ID는 동적 생성될 수 있음
    name: 60,
    class: 40,   // 클래스는 스타일링용으로 자주 변경됨
    css: 30,
    xpath: 20,   // 구조 변경에 취약
  };

  score = strategyScores[candidate.strategy] || 0;

  // 보너스/페널티
  if (candidate.isUnique) score += 5;
  if (candidate.isReadable) score += 5;
  if (candidate.selector.includes(':nth-child')) score -= 20;
  if (candidate.selector.split('>').length > 3) score -= 15;

  return Math.max(0, Math.min(100, score));
}
```

#### 녹화 시 다중 Selector 수집

```typescript
// event-collector/src/collector.ts (수정)
interface ElementInfo {
  // 기존
  selector: string;

  // 추가
  selectorCandidates: SelectorCandidate[];
  elementHtml: string;  // 미리보기용
}

function collectElementInfo(element: Element): ElementInfo {
  const candidates = SELECTOR_STRATEGIES
    .map(strategy => {
      const selector = strategy.generator(element);
      if (!selector) return null;

      return {
        strategy: strategy.name,
        selector,
        score: calculateStabilityScore({ strategy: strategy.name, selector, ... }),
        isUnique: document.querySelectorAll(selector).length === 1,
        isReadable: selector.length < 80,
        confidence: strategy.priority,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return {
    selector: candidates[0]?.selector || '',
    selectorCandidates: candidates,
    elementHtml: element.outerHTML.slice(0, 200),
  };
}
```

---

### 2.3 Pattern Presets

#### 목적
정규식을 직접 작성하는 대신, 일반적인 매칭 패턴을 드롭다운으로 선택

#### UI 디자인

```
┌─ Condition Editor ──────────────────────────────────────────────────┐
│                                                                      │
│  Left Operand:  [{{response.status}}              ]                 │
│                                                                      │
│  Match Type:    [Contains                       ▼]                  │
│                 ├─ Equals (exact match)                              │
│                 ├─ Not Equals                                        │
│                 ├─ Contains (substring)                              │
│                 ├─ Starts With                                       │
│                 ├─ Ends With                                         │
│                 ├─ Greater Than (number)                             │
│                 ├─ Less Than (number)                                │
│                 ├─ Is Empty                                          │
│                 ├─ Is Not Empty                                      │
│                 ├─ Matches Pattern... (advanced)                     │
│                 └─ ─────────────────                                 │
│                    Common Patterns:                                  │
│                    ├─ Email Address                                  │
│                    ├─ Phone Number                                   │
│                    ├─ URL                                            │
│                    └─ UUID                                           │
│                                                                      │
│  Right Operand: [success                         ]                  │
│                 (hidden for "Is Empty" / "Is Not Empty")            │
│                                                                      │
│  ┌─ Preview ──────────────────────────────────────────────────────┐ │
│  │ "pending" contains "success" → false                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### 구현 파일

| 파일 | 설명 |
|------|------|
| `packages/variable-store/src/patterns.ts` | 패턴 프리셋 정의 (신규) |
| `apps/extension/src/devtools/components/FlowBuilder/editors/ConditionEditor.tsx` | UI 수정 |

#### 패턴 프리셋 정의

```typescript
// variable-store/src/patterns.ts
export interface PatternPreset {
  id: string;
  label: string;
  description: string;
  category: 'comparison' | 'string' | 'validation';
  operator: ConditionOperator;
  // 일부 프리셋은 right operand가 고정됨
  fixedRight?: string;
  // 정규식 패턴 (matches 연산자용)
  regex?: string;
}

export const PATTERN_PRESETS: PatternPreset[] = [
  // Comparison
  { id: 'eq', label: 'Equals', description: 'Exact match', category: 'comparison', operator: 'eq' },
  { id: 'ne', label: 'Not Equals', description: 'Not equal to', category: 'comparison', operator: 'ne' },
  { id: 'gt', label: 'Greater Than', description: 'Number comparison', category: 'comparison', operator: 'gt' },
  { id: 'gte', label: 'Greater or Equal', description: 'Number comparison', category: 'comparison', operator: 'gte' },
  { id: 'lt', label: 'Less Than', description: 'Number comparison', category: 'comparison', operator: 'lt' },
  { id: 'lte', label: 'Less or Equal', description: 'Number comparison', category: 'comparison', operator: 'lte' },

  // String
  { id: 'contains', label: 'Contains', description: 'Substring match', category: 'string', operator: 'contains' },
  { id: 'startsWith', label: 'Starts With', description: 'Prefix match', category: 'string', operator: 'startsWith' },
  { id: 'endsWith', label: 'Ends With', description: 'Suffix match', category: 'string', operator: 'endsWith' },
  { id: 'isEmpty', label: 'Is Empty', description: 'Null, undefined, or empty string', category: 'string', operator: 'isEmpty' },
  { id: 'exists', label: 'Exists', description: 'Not null or undefined', category: 'string', operator: 'exists' },

  // Validation (regex-based)
  {
    id: 'isEmail',
    label: 'Is Email',
    description: 'Valid email format',
    category: 'validation',
    operator: 'matches',
    regex: '^[\\w.-]+@[\\w.-]+\\.\\w{2,}$',
  },
  {
    id: 'isUrl',
    label: 'Is URL',
    description: 'Valid URL format',
    category: 'validation',
    operator: 'matches',
    regex: '^https?://[\\w.-]+(?:/[\\w./-]*)?$',
  },
  {
    id: 'isUuid',
    label: 'Is UUID',
    description: 'UUID v4 format',
    category: 'validation',
    operator: 'matches',
    regex: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  },
  {
    id: 'isPhone',
    label: 'Is Phone',
    description: 'Phone number format',
    category: 'validation',
    operator: 'matches',
    regex: '^\\+?[0-9]{10,15}$',
  },
];

// 프리셋에서 조건 생성
export function createConditionFromPreset(
  preset: PatternPreset,
  left: string,
  right?: string
): FlowCondition {
  return {
    left,
    operator: preset.operator,
    right: preset.regex || preset.fixedRight || right,
  };
}
```

#### ConditionEditor 수정

```typescript
// ConditionEditor.tsx (수정)
import { PATTERN_PRESETS, type PatternPreset } from '@like-cake/variable-store';

function ConditionEditor({ ... }) {
  const [selectedPreset, setSelectedPreset] = useState<string>('eq');

  const preset = PATTERN_PRESETS.find(p => p.id === selectedPreset);
  const isUnary = preset?.operator === 'exists' || preset?.operator === 'isEmpty';
  const hasFixedRight = !!preset?.regex;

  return (
    <div>
      {/* Left operand */}
      <input value={left} onChange={...} />

      {/* Preset selector */}
      <select value={selectedPreset} onChange={e => setSelectedPreset(e.target.value)}>
        <optgroup label="Comparison">
          {PATTERN_PRESETS.filter(p => p.category === 'comparison').map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </optgroup>
        <optgroup label="String">
          {PATTERN_PRESETS.filter(p => p.category === 'string').map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </optgroup>
        <optgroup label="Validation">
          {PATTERN_PRESETS.filter(p => p.category === 'validation').map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </optgroup>
      </select>

      {/* Right operand - hidden for unary or fixed-right presets */}
      {!isUnary && !hasFixedRight && (
        <input value={right} onChange={...} />
      )}
    </div>
  );
}
```

---

## 3. 구현 순서

### Phase 1: Pattern Presets (1일)
가장 간단하며, 기존 ConditionEditor 수정만으로 가능

1. `packages/variable-store/src/patterns.ts` 생성
2. `ConditionEditor.tsx` 수정 - 프리셋 드롭다운 추가
3. 카테고리별 그룹화 및 설명 표시

### Phase 2: JSONPath Picker (2일)
ExtractionEditor 확장

1. `JsonTreeViewer` 컴포넌트 생성
2. `PathBuilder` 유틸 구현
3. `ExtractionEditor`에 트리 뷰어 통합
4. "Test" 버튼으로 경로 검증

### Phase 3: Selector Recommender (3일)
녹화 시스템과 편집 UI 모두 수정 필요

1. `selector-engine` 패키지에 다중 전략 수집 로직 추가
2. `scorer.ts`로 안정성 점수 계산
3. `event-collector`에서 `selectorCandidates` 수집
4. `SelectorPicker` 컴포넌트 생성
5. Step 편집 UI에 Selector 선택 UI 통합

---

## 4. 파일 변경 요약

### 신규 파일

| 파일 | 설명 |
|------|------|
| `packages/variable-store/src/patterns.ts` | 패턴 프리셋 정의 |
| `packages/selector-engine/src/scorer.ts` | Selector 안정성 점수 |
| `apps/extension/src/devtools/components/JsonTreeViewer/index.tsx` | JSON 트리 뷰어 |
| `apps/extension/src/devtools/components/JsonTreeViewer/TreeNode.tsx` | 트리 노드 컴포넌트 |
| `apps/extension/src/devtools/components/JsonTreeViewer/PathBuilder.ts` | JSONPath 생성 |
| `apps/extension/src/devtools/components/SelectorPicker/index.tsx` | Selector 선택 UI |
| `apps/extension/src/devtools/components/SelectorPicker/SelectorOption.tsx` | 옵션 컴포넌트 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `packages/selector-engine/src/strategies/index.ts` | 다중 전략 수집 |
| `packages/event-collector/src/collector.ts` | selectorCandidates 수집 |
| `packages/ast-types/src/types/selector.ts` | SelectorCandidate 타입 추가 |
| `apps/extension/.../editors/ConditionEditor.tsx` | 프리셋 드롭다운 |
| `apps/extension/.../editors/ExtractionEditor.tsx` | JSONPath 피커 통합 |

---

## 5. 예상 일정

| Phase | 작업 | 예상 기간 |
|-------|------|-----------|
| 1 | Pattern Presets | 1일 |
| 2 | JSONPath Picker | 2일 |
| 3 | Selector Recommender | 3일 |
| **총계** | | **6일** |

---

## 6. 성공 지표

구현 완료 후 사용자는:

1. **JSONPath**: API 응답 트리에서 클릭만으로 경로 선택 가능
2. **Selector**: 녹화된 요소에 대해 여러 옵션 중 선택 가능
3. **조건**: "Contains", "Is Email" 등 프리셋으로 조건 설정 가능

**결과**: 기술적 문법(JSONPath, CSS Selector, Regex) 직접 작성 → **0줄**
