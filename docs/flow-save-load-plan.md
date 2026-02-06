# Flow 저장/불러오기 기능 기획안

> **작성일**: 2026-02-06
> **상태**: Draft
> **관련 경로**: `apps/extension/src/devtools/components/FlowBuilder/`

---

## 1. 개요

### 1.1 목적
사용자가 FlowBuilder에서 작성한 테스트 플로우를 **저장, 목록 조회, 불러오기, 삭제**할 수 있는 기능을 구현한다.

### 1.2 현재 상태 분석

| 영역 | 상태 | 비고 |
|------|------|------|
| Backend CRUD API | ✅ 완료 | GET/POST/PATCH/DELETE `/api/userflows` |
| DB 스키마 (`user_flows`) | ✅ 완료 | nodes/edges JSON 직렬화 저장 |
| API Client (Extension) | ✅ 완료 | `listUserFlows`, `getUserFlow` 등 |
| Flow 저장 (Create/Update) | ✅ 완료 | FlowBuilder `handleSave` |
| Flow 불러오기 UI | ❌ 미구현 | 목록 조회, 선택, 로드 UI 없음 |
| Flow 관리 UI | ❌ 미구현 | 삭제, 복제, 이름 변경 등 |
| 미저장 변경 감지 | ⚠️ 부분 | `isModified` 상태만 존재, 경고 없음 |

### 1.3 목표
- 저장된 플로우 목록을 조회하고 선택하여 캔버스에 로드
- 새 플로우 생성, 기존 플로우 삭제/복제 지원
- 미저장 변경사항 이탈 시 경고
- 최근 열었던 플로우 빠른 접근

---

## 2. 팀 구성

| 역할 | 이름 | 담당 영역 |
|------|------|-----------|
| **FE Lead** | 팀원 A | FlowListPanel UI, 플로우 목록/검색 컴포넌트 |
| **FE 상태관리** | 팀원 B | FlowBuilder 상태 리팩터링, useFlowState 연동, 미저장 감지 |
| **BE/API** | 팀원 C | API 확장 (복제, 검색, 정렬), E2E 테스트 |
| **UX/통합** | 팀원 D | 전체 플로우 UX 설계, 툴바 통합, 토스트/모달 UI |

---

## 3. 기능 명세

### 3.1 플로우 목록 패널 (FlowListPanel)

**담당: 팀원 A**

```
┌─────────────────────────────────┐
│  📂 내 플로우            [+ 새로 만들기] │
│  ┌─────────────────────────────┐ │
│  │ 🔍 플로우 검색...            │ │
│  └─────────────────────────────┘ │
│                                 │
│  ┌─────────────────────────────┐ │
│  │ 로그인 → 결제 플로우         │ │
│  │ 수정: 2분 전  |  노드 8개    │ │
│  │           [열기] [⋮ 더보기]  │ │
│  └─────────────────────────────┘ │
│  ┌─────────────────────────────┐ │
│  │ 회원가입 플로우              │ │
│  │ 수정: 1시간 전  |  노드 5개  │ │
│  │           [열기] [⋮ 더보기]  │ │
│  └─────────────────────────────┘ │
│                                 │
│  ── 최근 열어본 플로우 ──        │
│  · 상품 검색 시나리오            │
│  · 마이페이지 테스트             │
└─────────────────────────────────┘
```

#### 기능 상세
- **목록 조회**: `listUserFlows()` 호출, `updatedAt` 내림차순 정렬
- **검색**: 플로우 이름 기준 클라이언트 필터링 (추후 서버 검색 확장 가능)
- **정렬**: 최근 수정순 (기본), 이름순, 생성일순
- **카드 정보**: 플로우 이름, 설명, 수정 시각(상대 시간), 노드 개수
- **더보기 메뉴**: 이름 변경, 복제, 삭제

#### 컴포넌트 구조
```
FlowListPanel/
├── index.tsx          # 패널 컨테이너
├── FlowCard.tsx       # 개별 플로우 카드
├── FlowSearchBar.tsx  # 검색 입력
└── FlowContextMenu.tsx # 더보기(⋮) 드롭다운 메뉴
```

---

### 3.2 FlowBuilder 상태 리팩터링

**담당: 팀원 B**

#### 현재 문제
```typescript
// 현재: useFlowState가 항상 빈 상태로 시작
const { nodes, edges, ... } = useFlowState([], []);

// 현재: flowId가 없으면 항상 새로 생성
const handleSave = async () => {
  if (flowId) { /* update */ } else { /* create */ }
};
```

#### 개선 방향

**a) `useFlowManager` 훅 신규 생성**
```typescript
interface FlowManagerState {
  flowId: string | null;
  flowName: string;
  flowDescription: string;
  isModified: boolean;
  isSaving: boolean;
  isLoading: boolean;
  lastSavedAt: number | null;
}

function useFlowManager() {
  // 플로우 메타데이터 상태 관리
  // save, load, create, delete 액션
  // isModified 자동 추적 (nodes/edges 변경 감지)
  return {
    state: FlowManagerState,
    actions: {
      loadFlow: (flowId: string) => Promise<void>,
      saveFlow: () => Promise<void>,
      createNewFlow: () => void,
      deleteFlow: (flowId: string) => Promise<void>,
      duplicateFlow: (flowId: string) => Promise<void>,
      setFlowName: (name: string) => void,
    }
  };
}
```

**b) `useFlowState` 초기 데이터 주입 지원**
```typescript
// 개선: loadFlow 시 초기 데이터 전달
const loadFlow = async (flowId: string) => {
  const flow = await client.getUserFlow(flowId);
  setNodes(convertToReactFlowNodes(flow.nodes));
  setEdges(convertToReactFlowEdges(flow.edges));
  setFlowId(flow.id);
  setFlowName(flow.name);
  setIsModified(false);
};
```

**c) 미저장 변경 감지**
```typescript
// nodes/edges 변경 시 isModified = true
// 저장 성공 시 isModified = false
// 다른 플로우 열기/새로 만들기 시 경고 모달 표시
```

---

### 3.3 API 확장

**담당: 팀원 C**

#### 신규 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/userflows/:id/duplicate` | 플로우 복제 |
| `GET` | `/api/userflows?search=keyword` | 이름 검색 쿼리 |
| `GET` | `/api/userflows?sort=name\|updatedAt\|createdAt` | 정렬 옵션 |

#### 복제 API 상세
```typescript
// POST /api/userflows/:id/duplicate
// Request: { name?: string }  (미입력 시 "원본이름 (복사)" 자동생성)
// Response: 201 Created, { data: BackendUserFlow }
```

#### API Client 확장
```typescript
// apps/extension/src/shared/api.ts
async duplicateUserFlow(flowId: string, name?: string): Promise<ApiResponse<BackendUserFlow>>
```

#### 테스트
- 복제 API 통합 테스트
- 검색/정렬 쿼리 파라미터 테스트
- 플로우 저장 → 불러오기 → 수정 → 재저장 E2E 시나리오

---

### 3.4 UX/통합

**담당: 팀원 D**

#### a) 툴바 개선

```
현재 툴바:
┌──────────────────────────────────────────────────┐
│ [Flow Name Input]           [Clear] [Run] [Save] │
└──────────────────────────────────────────────────┘

개선 툴바:
┌──────────────────────────────────────────────────────────────┐
│ [📂 열기] [Flow Name ●] [설명 편집]    [+ 새로 만들기] [▶ 실행] [💾 저장] │
└──────────────────────────────────────────────────────────────┘
                        ↑
                  ● = 미저장 변경 표시 (dot indicator)
```

#### b) 진입 화면 (빈 캔버스 상태)

플로우가 로드되지 않은 초기 상태:
```
┌─────────────────────────────────────────┐
│                                         │
│          테스트 플로우 빌더              │
│                                         │
│    [📂 기존 플로우 열기]                 │
│    [+ 새 플로우 만들기]                  │
│                                         │
│    ── 최근 플로우 ──                     │
│    · 로그인 → 결제 (2분 전)              │
│    · 회원가입 (1시간 전)                 │
│                                         │
└─────────────────────────────────────────┘
```

#### c) 모달/토스트

| 상황 | UI | 동작 |
|------|-----|------|
| 미저장 상태에서 다른 플로우 열기 | Confirm 모달 | "저장하지 않은 변경사항이 있습니다. 저장하시겠습니까?" → [저장] [저장 안 함] [취소] |
| 플로우 삭제 | Confirm 모달 | "'{이름}' 플로우를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다." → [삭제] [취소] |
| 저장 성공 | Toast | "플로우가 저장되었습니다" (2초 자동 닫힘) |
| 저장 실패 | Toast (error) | "저장에 실패했습니다. 다시 시도해주세요." |
| 복제 성공 | Toast | "'{이름}' 플로우가 복제되었습니다" |
| 로드 실패 | Toast (error) | "플로우를 불러올 수 없습니다" |

#### d) 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl/Cmd + S` | 플로우 저장 |
| `Ctrl/Cmd + O` | 플로우 열기 (FlowListPanel 토글) |
| `Ctrl/Cmd + N` | 새 플로우 만들기 |

---

## 4. 화면 흐름도

```
[Extension DevTools]
    │
    ├── FlowBuilder (빈 캔버스)
    │       │
    │       ├── "기존 플로우 열기" 클릭
    │       │       │
    │       │       └── FlowListPanel 열림
    │       │               │
    │       │               ├── 플로우 선택 → 캔버스에 로드
    │       │               ├── 검색/정렬
    │       │               ├── 더보기 → 이름변경/복제/삭제
    │       │               └── 닫기
    │       │
    │       ├── "새 플로우 만들기" 클릭
    │       │       └── 빈 캔버스 + Start/End 노드 자동 생성
    │       │
    │       ├── 노드 편집 중...
    │       │       └── isModified = true (● 표시)
    │       │
    │       ├── "저장" 클릭 (Ctrl+S)
    │       │       ├── flowId 있음 → PATCH (업데이트)
    │       │       └── flowId 없음 → POST (생성)
    │       │
    │       └── "열기" 클릭 (미저장 상태)
    │               └── Confirm 모달 → [저장/저장 안 함/취소]
    │
    └── ScenarioDetailPanel
            └── "플로우에서 보기" → FlowBuilder로 전환 + 해당 플로우 로드
```

---

## 5. 데이터 플로우

```
[FlowListPanel]                    [FlowBuilder]                     [Backend]
     │                                  │                                │
     │── listUserFlows() ──────────────────────────────────────────────►│
     │◄─────────────────────────────── flows[] ────────────────────────│
     │                                  │                                │
     │── "열기" 클릭 ──────────────────►│                                │
     │                                  │── getUserFlow(id) ───────────►│
     │                                  │◄──────────── flow data ──────│
     │                                  │                                │
     │                                  │── setNodes(flow.nodes) ──┐    │
     │                                  │── setEdges(flow.edges) ──┘    │
     │                                  │── setFlowId(flow.id)          │
     │                                  │                                │
     │                                  │   ... 편집 ...                 │
     │                                  │                                │
     │                                  │── handleSave() ──────────────►│
     │                                  │   PATCH /userflows/:id         │
     │                                  │◄──────────── 200 OK ─────────│
```

---

## 6. 작업 일정 (스프린트 기준)

### Sprint 1 (Week 1) — 핵심 기능

| 담당 | 작업 | 산출물 |
|------|------|--------|
| 팀원 A | FlowListPanel 컴포넌트 구현 | `FlowListPanel/index.tsx`, `FlowCard.tsx` |
| 팀원 B | `useFlowManager` 훅 구현, `useFlowState` 로드 연동 | `useFlowManager.ts` |
| 팀원 C | 복제 API, 검색/정렬 쿼리 파라미터 추가 | `userflows.ts`, `userflow.service.ts` |
| 팀원 D | 툴바 UI 개선, Confirm/Toast 컴포넌트 | 툴바, 모달, 토스트 |

### Sprint 2 (Week 2) — 통합 및 UX

| 담당 | 작업 | 산출물 |
|------|------|--------|
| 팀원 A | 검색, 정렬, 더보기 메뉴 구현 | `FlowSearchBar.tsx`, `FlowContextMenu.tsx` |
| 팀원 B | 미저장 변경 감지, 이탈 경고 연동 | isModified 추적 로직 |
| 팀원 C | E2E 테스트 작성 | 통합 테스트 |
| 팀원 D | 빈 캔버스 진입 화면, 키보드 단축키, 최근 플로우 | 진입 화면, 단축키 |

### Sprint 3 (Week 3) — QA 및 마무리

| 담당 | 작업 |
|------|------|
| 전원 | 크로스 테스트, 버그 수정, 코드 리뷰 |
| 팀원 D | 최종 UX 검수, 엣지 케이스 처리 |

---

## 7. 시나리오 참조 무결성 (Orphaned Reference 대응)

### 7.1 문제 정의

플로우의 `scenario` 노드는 `scenarioId`로 시나리오를 참조한다.
그런데 `scenarioId`가 **JSON blob 안에 저장**되어 있어 DB 레벨 FK 제약이 불가능하다.

```
user_flows.nodes (JSON)                  scenarios 테이블
┌──────────────────────────┐            ┌──────────────┐
│ { type: "scenario",      │──참조──→   │ id: "sc-001" │ ← 삭제되면?
│   data: {                │            └──────────────┘
│     scenarioId: "sc-001" │            ❌ FK 제약 없음
│   }                      │            ❌ CASCADE 없음
│ }                        │            ❌ 사전 경고 없음
└──────────────────────────┘
```

**현재 동작**: `flow-executor.ts`에서 실행 시점에 `Scenario not found` → `skipped` 처리.
사용자는 플로우를 **실행해봐야** 깨진 참조를 발견할 수 있다.

### 7.2 채택 전략: 삭제 시점 보호 + 로드 시점 검증 (이중 방어)

단일 전략으로는 모든 케이스를 커버할 수 없으므로, **2개 전략을 조합**한다.

#### A. 삭제 시점 보호 (Delete Guard) — 담당: 팀원 C

시나리오 삭제 API(`DELETE /api/scenarios/:id`)에 참조 검사를 추가한다.

```typescript
// scenario.service.ts 또는 scenarios.ts 라우터
function getFlowsReferencingScenario(scenarioId: string): { id: string; name: string }[] {
  const db = getDb();
  // SQLite json_each로 nodes JSON 내부 scenarioId 검색
  const stmt = db.prepare(`
    SELECT uf.id, uf.name
    FROM user_flows uf, json_each(uf.nodes) AS node
    WHERE json_extract(node.value, '$.type') = 'scenario'
      AND json_extract(node.value, '$.data.scenarioId') = ?
  `);
  return stmt.all(scenarioId);
}
```

**삭제 API 응답 분기:**

| 상황 | 응답 | 동작 |
|------|------|------|
| 참조하는 플로우 없음 | `200 OK` | 바로 삭제 |
| 참조하는 플로우 있음 | `409 Conflict` | `{ referencedBy: [{ id, name }] }` 반환 |
| 강제 삭제 요청 (`?force=true`) | `200 OK` | 삭제 진행 (사용자 확인 후) |

**Extension UI 대응 (팀원 D):**
```
"이 시나리오는 다음 플로우에서 사용 중입니다:
 · 로그인 → 결제 플로우
 · 회원가입 플로우
정말 삭제하시겠습니까?"
→ [삭제] [취소]
```

#### B. 로드 시점 검증 (Load-time Validation) — 담당: 팀원 B

플로우를 불러올 때 각 scenario 노드의 `scenarioId` 존재 여부를 확인한다.

```typescript
// useFlowManager.ts - loadFlow 내부
const validateScenarioRefs = async (nodes: FlowNode[]) => {
  const scenarioNodes = nodes.filter(n => n.type === 'scenario');
  const scenarioIds = scenarioNodes.map(n => n.data.scenarioId);

  // 일괄 조회 API 또는 개별 조회
  const results = await Promise.all(
    scenarioIds.map(id => client.getScenario(id).catch(() => null))
  );

  return scenarioNodes.map((node, i) => ({
    nodeId: node.id,
    scenarioId: node.data.scenarioId,
    scenarioName: node.data.scenarioName,
    exists: results[i] !== null,
  }));
};
```

**UI 표현 (팀원 A/D):**

```
정상 노드:           깨진 노드:
┌──────────────┐    ┌──────────────┐
│ 🟢 로그인     │    │ ⚠️ 결제 검증  │  ← 빨간 테두리 + 경고 아이콘
│ 시나리오      │    │ 시나리오 삭제됨│  ← "삭제된 시나리오" 라벨
│ steps: 5     │    │ [교체] [제거] │  ← 액션 버튼
└──────────────┘    └──────────────┘
```

**깨진 노드 사용자 액션:**
- **교체**: 다른 시나리오를 선택하여 `scenarioId` 교체
- **제거**: 해당 노드 + 연결 엣지 삭제
- **무시**: 경고 상태로 저장 가능 (실행 시 skipped 처리)

#### C. 플로우 저장 시점 경고 (Save-time Warning) — 담당: 팀원 B

깨진 참조가 있는 상태로 저장하려 하면 토스트 경고를 표시한다.

```
⚠️ "삭제된 시나리오를 참조하는 노드가 2개 있습니다. 저장하시겠습니까?"
→ [저장] [취소]
```

### 7.3 검증 API 추가 — 담당: 팀원 C

플로우 내 시나리오 참조를 일괄 검증하는 전용 API를 추가한다.

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/userflows/:id/validate` | 플로우 내 참조 무결성 검증 |
| `POST` | `/api/scenarios/check-refs` | 시나리오 ID 목록의 존재 여부 일괄 확인 |

```typescript
// POST /api/scenarios/check-refs
// Request:  { ids: ["sc-001", "sc-002", "sc-003"] }
// Response: { results: { "sc-001": true, "sc-002": false, "sc-003": true } }
```

이를 통해 프론트에서 시나리오 개수만큼 API를 호출하지 않고 **한 번에 검증**할 수 있다.

### 7.4 담당 배분 요약

| 작업 | 담당 | 스프린트 |
|------|------|----------|
| `getFlowsReferencingScenario()` 쿼리 구현 | 팀원 C | Sprint 1 |
| 시나리오 삭제 API에 Delete Guard 추가 | 팀원 C | Sprint 1 |
| `POST /api/scenarios/check-refs` API | 팀원 C | Sprint 1 |
| `validateScenarioRefs()` 훅 로직 | 팀원 B | Sprint 1 |
| 깨진 노드 UI (경고 배지, 교체/제거 버튼) | 팀원 A/D | Sprint 2 |
| 삭제 경고 모달 (참조 플로우 목록 표시) | 팀원 D | Sprint 2 |
| 저장 시 경고 토스트 | 팀원 B | Sprint 2 |

---

## 8. 기술적 고려사항

### 8.1 상태 관리 전략
- 글로벌 상태 도입 없이 **FlowBuilder 내부 훅**으로 해결
- `useFlowManager`가 메타데이터 + CRUD 액션을 캡슐화
- `useFlowState`는 캔버스 상태(nodes/edges)만 관리 (기존 역할 유지)

### 8.2 성능
- 플로우 목록은 **페이지네이션** 적용 (기존 API 지원)
- 목록 조회 시 nodes/edges 전체를 내려주지 않도록 **summary 응답** 고려
  - 이미 `list` API가 전체 데이터를 반환 중 → 목록용 경량 응답 추가 검토

### 8.3 에러 처리
- 네트워크 오류 시 retry 없이 토스트로 안내
- 동시 편집 충돌은 현재 스코프 아웃 (단일 사용자 가정)

### 8.4 마이그레이션
- DB 스키마 변경 없음 (기존 `user_flows` 테이블 그대로 사용)
- 기존 저장된 플로우 데이터와 100% 호환

---

## 9. 스코프 아웃 (향후 고려)

- [ ] 플로우 버전 관리 (히스토리)
- [ ] 플로우 공유 (export/import JSON)
- [ ] 플로우 태그/폴더 분류
- [ ] 플로우 템플릿 갤러리
- [ ] 동시 편집 (멀티 유저)
- [ ] 플로우 실행 결과와 연결된 비교 뷰

---

## 10. 성공 기준

- [ ] 사용자가 FlowBuilder에서 플로우를 저장하고 다시 불러올 수 있다
- [ ] 저장된 플로우 목록을 조회하고 검색할 수 있다
- [ ] 플로우를 복제하고 삭제할 수 있다
- [ ] 미저장 변경사항이 있을 때 이탈 경고가 표시된다
- [ ] Ctrl+S/O/N 단축키가 동작한다
- [ ] 시나리오 삭제 시 참조 중인 플로우가 있으면 경고가 표시된다
- [ ] 삭제된 시나리오를 참조하는 노드가 플로우 로드 시 경고 배지로 표시된다
- [ ] 깨진 참조 노드를 교체하거나 제거할 수 있다
