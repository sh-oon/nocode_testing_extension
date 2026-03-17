/**
 * Event Catalog — all supported user interactions
 *
 * 15 events across 5 categories: mouse, keyboard, form, navigation, timing.
 * Each entry maps to an existing StepType where possible (null = new executor needed).
 */

import type { EventCatalogEntry, EventCategory } from '../types/event-catalog';

export const EVENT_CATALOG: EventCatalogEntry[] = [
  // ── Mouse ──────────────────────────────────────────────────────────────
  {
    id: 'click',
    label: '클릭',
    description: '요소를 클릭합니다',
    category: 'mouse',
    elementRequirement: 'required',
    params: [],
    mappedStepType: 'click',
    tags: ['mouse', 'basic'],
  },
  {
    id: 'doubleClick',
    label: '더블클릭',
    description: '요소를 더블클릭합니다',
    category: 'mouse',
    elementRequirement: 'required',
    params: [
      { name: 'clickCount', label: '클릭 횟수', type: 'number', required: false, defaultValue: 2 },
    ],
    mappedStepType: 'click',
    tags: ['mouse'],
  },
  {
    id: 'hover',
    label: '마우스 올린다',
    description: '요소 위에 마우스를 올립니다',
    category: 'mouse',
    elementRequirement: 'required',
    params: [],
    mappedStepType: 'hover',
    tags: ['mouse'],
  },
  {
    id: 'mouseout',
    label: '마우스 뗀다',
    description: '요소에서 마우스를 벗어납니다',
    category: 'mouse',
    elementRequirement: 'required',
    params: [],
    mappedStepType: null,
    tags: ['mouse'],
  },
  {
    id: 'dragAndDrop',
    label: '드래그 앤 드롭',
    description: '요소를 드래그하여 다른 위치에 놓습니다',
    category: 'mouse',
    elementRequirement: 'required',
    params: [
      {
        name: 'dropTarget',
        label: '놓을 위치',
        type: 'string',
        required: true,
        placeholder: '드롭 대상 셀렉터',
      },
    ],
    mappedStepType: null,
    tags: ['mouse', 'drag'],
  },
  {
    id: 'scroll',
    label: '스크롤',
    description: '페이지 또는 요소를 스크롤합니다',
    category: 'mouse',
    elementRequirement: 'optional',
    params: [
      { name: 'x', label: 'X 오프셋', type: 'number', required: false, defaultValue: 0 },
      { name: 'y', label: 'Y 오프셋', type: 'number', required: false, defaultValue: 0 },
    ],
    mappedStepType: 'scroll',
    tags: ['mouse', 'scroll'],
  },

  // ── Keyboard ───────────────────────────────────────────────────────────
  {
    id: 'type',
    label: '값 입력',
    description: '요소에 텍스트를 입력합니다',
    category: 'keyboard',
    elementRequirement: 'required',
    params: [
      {
        name: 'value',
        label: '입력 값',
        type: 'string',
        required: true,
        placeholder: '입력할 텍스트',
      },
      {
        name: 'clear',
        label: '기존 값 지우기',
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      {
        name: 'delay',
        label: '입력 딜레이 (ms)',
        type: 'number',
        required: false,
        defaultValue: 0,
      },
    ],
    mappedStepType: 'type',
    tags: ['keyboard', 'input', 'basic'],
  },
  {
    id: 'clear',
    label: '값 지우기',
    description: '요소의 기존 값을 지웁니다',
    category: 'keyboard',
    elementRequirement: 'required',
    params: [],
    mappedStepType: 'type',
    tags: ['keyboard', 'input'],
  },
  {
    id: 'keypress',
    label: '키 누르기',
    description: '특정 키를 누릅니다 (Enter, Escape 등)',
    category: 'keyboard',
    elementRequirement: 'optional',
    params: [
      {
        name: 'key',
        label: '키',
        type: 'key',
        required: true,
        placeholder: 'Enter, Escape, Tab...',
      },
      {
        name: 'modifiers',
        label: '보조 키',
        type: 'select',
        required: false,
        options: [
          { label: 'None', value: '' },
          { label: 'Ctrl', value: 'Control' },
          { label: 'Shift', value: 'Shift' },
          { label: 'Alt', value: 'Alt' },
          { label: 'Meta', value: 'Meta' },
        ],
      },
    ],
    mappedStepType: 'keypress',
    tags: ['keyboard', 'key'],
  },

  // ── Form ───────────────────────────────────────────────────────────────
  {
    id: 'select',
    label: '드롭다운 선택',
    description: '드롭다운에서 옵션을 선택합니다',
    category: 'form',
    elementRequirement: 'required',
    params: [
      {
        name: 'value',
        label: '선택 값',
        type: 'string',
        required: true,
        placeholder: '선택할 옵션 값',
      },
    ],
    mappedStepType: 'select',
    tags: ['form', 'select'],
  },
  {
    id: 'fileUpload',
    label: '파일 업로드',
    description: '파일 입력 요소에 파일을 업로드합니다',
    category: 'form',
    elementRequirement: 'required',
    params: [
      {
        name: 'filePath',
        label: '파일 경로',
        type: 'file',
        required: true,
        placeholder: '업로드할 파일 경로',
      },
    ],
    mappedStepType: null,
    tags: ['form', 'file'],
  },

  // ── Navigation ─────────────────────────────────────────────────────────
  {
    id: 'navigate',
    label: '페이지 이동',
    description: '지정한 URL로 이동합니다',
    category: 'navigation',
    elementRequirement: 'none',
    params: [
      { name: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://...' },
      {
        name: 'waitUntil',
        label: '대기 조건',
        type: 'select',
        required: false,
        defaultValue: 'networkidle2',
        options: [
          { label: 'Load', value: 'load' },
          { label: 'DOM Content Loaded', value: 'domcontentloaded' },
          { label: 'Network Idle', value: 'networkidle2' },
        ],
      },
    ],
    mappedStepType: 'navigate',
    tags: ['navigation', 'basic'],
  },
  {
    id: 'historyBack',
    label: '뒤로가기',
    description: '브라우저 뒤로가기',
    category: 'navigation',
    elementRequirement: 'none',
    params: [],
    mappedStepType: null,
    tags: ['navigation', 'history'],
  },
  {
    id: 'historyForward',
    label: '앞으로가기',
    description: '브라우저 앞으로가기',
    category: 'navigation',
    elementRequirement: 'none',
    params: [],
    mappedStepType: null,
    tags: ['navigation', 'history'],
  },

  // ── Timing ─────────────────────────────────────────────────────────────
  {
    id: 'wait',
    label: '대기',
    description: '지정한 시간만큼 대기합니다',
    category: 'timing',
    elementRequirement: 'none',
    params: [
      {
        name: 'duration',
        label: '대기 시간 (ms)',
        type: 'number',
        required: true,
        defaultValue: 1000,
      },
    ],
    mappedStepType: 'wait',
    tags: ['timing', 'wait'],
  },
];

/** Get events filtered by category */
export const getEventsByCategory = (category: EventCategory): EventCatalogEntry[] =>
  EVENT_CATALOG.filter((e) => e.category === category);

/** Find an event by its ID */
export const getEventById = (id: string): EventCatalogEntry | undefined =>
  EVENT_CATALOG.find((e) => e.id === id);
