/**
 * Verification Catalog — all supported assertions/checks
 *
 * 22 verifications across 5 categories: element, content, form, page, api.
 * Each entry maps to an existing assertion type where possible (null = new assertion needed).
 */

import type { VerificationCatalogEntry, VerificationCategory } from '../types/verification-catalog';

export const VERIFICATION_CATALOG: VerificationCatalogEntry[] = [
  // ── Element (6) ────────────────────────────────────────────────────────
  {
    id: 'visible',
    label: '보여질 때',
    description: '요소가 화면에 보이는지 확인합니다',
    category: 'element',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: 'visible',
    tags: ['element', 'visibility'],
  },
  {
    id: 'hidden',
    label: '안 보일 때',
    description: '요소가 화면에 보이지 않는지 확인합니다',
    category: 'element',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: 'hidden',
    tags: ['element', 'visibility'],
  },
  {
    id: 'exists',
    label: '있을 때',
    description: '요소가 DOM에 존재하는지 확인합니다',
    category: 'element',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: 'exists',
    tags: ['element', 'existence'],
  },
  {
    id: 'notExists',
    label: '없을 때',
    description: '요소가 DOM에 존재하지 않는지 확인합니다',
    category: 'element',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: 'notExists',
    tags: ['element', 'existence'],
  },
  {
    id: 'count',
    label: '특정 개수만큼 있을 때',
    description: '요소의 개수를 확인합니다',
    category: 'element',
    elementRequirement: 'required',
    params: [
      { name: 'value', label: '기대 개수', type: 'number', required: true },
      {
        name: 'operator',
        label: '비교 연산자',
        type: 'select',
        required: false,
        defaultValue: 'eq',
        options: [
          { label: '같다 (=)', value: 'eq' },
          { label: '크다 (>)', value: 'gt' },
          { label: '크거나 같다 (>=)', value: 'gte' },
          { label: '작다 (<)', value: 'lt' },
          { label: '작거나 같다 (<=)', value: 'lte' },
        ],
      },
    ],
    mappedAssertionType: 'count',
    tags: ['element', 'count'],
  },
  {
    id: 'elementEmpty',
    label: '비어있을 때',
    description: '요소의 텍스트가 비어있는지 확인합니다',
    category: 'element',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: 'text',
    tags: ['element', 'empty'],
  },

  // ── Content (5) ────────────────────────────────────────────────────────
  {
    id: 'textContains',
    label: '특정 텍스트 포함',
    description: '요소에 특정 텍스트가 포함되어 있는지 확인합니다',
    category: 'content',
    elementRequirement: 'required',
    params: [
      {
        name: 'value',
        label: '포함 텍스트',
        type: 'string',
        required: true,
        placeholder: '확인할 텍스트',
      },
    ],
    mappedAssertionType: 'text',
    tags: ['content', 'text'],
  },
  {
    id: 'textEquals',
    label: '텍스트 일치',
    description: '요소의 텍스트가 정확히 일치하는지 확인합니다',
    category: 'content',
    elementRequirement: 'required',
    params: [
      {
        name: 'value',
        label: '일치 텍스트',
        type: 'string',
        required: true,
        placeholder: '확인할 텍스트',
      },
    ],
    mappedAssertionType: 'text',
    tags: ['content', 'text'],
  },
  {
    id: 'attributeExists',
    label: '특정 속성 있을 때',
    description: '요소에 특정 HTML 속성이 존재하는지 확인합니다',
    category: 'content',
    elementRequirement: 'required',
    params: [
      {
        name: 'name',
        label: '속성 이름',
        type: 'string',
        required: true,
        placeholder: 'data-testid',
      },
    ],
    mappedAssertionType: 'attribute',
    tags: ['content', 'attribute'],
  },
  {
    id: 'attributeValue',
    label: '특정 속성 값',
    description: '요소의 HTML 속성 값이 일치하는지 확인합니다',
    category: 'content',
    elementRequirement: 'required',
    params: [
      {
        name: 'name',
        label: '속성 이름',
        type: 'string',
        required: true,
        placeholder: 'data-testid',
      },
      { name: 'value', label: '속성 값', type: 'string', required: true, placeholder: '기대 값' },
    ],
    mappedAssertionType: 'attribute',
    tags: ['content', 'attribute'],
  },
  {
    id: 'classNameExists',
    label: '특정 클래스 있을 때',
    description: '요소에 특정 CSS 클래스가 있는지 확인합니다',
    category: 'content',
    elementRequirement: 'required',
    params: [
      {
        name: 'value',
        label: '클래스 이름',
        type: 'string',
        required: true,
        placeholder: 'active',
      },
    ],
    mappedAssertionType: 'attribute',
    tags: ['content', 'class', 'attribute'],
  },

  // ── Form (5) ───────────────────────────────────────────────────────────
  {
    id: 'checkboxChecked',
    label: '체크됨',
    description: '체크박스가 체크되어 있는지 확인합니다',
    category: 'form',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: 'attribute',
    tags: ['form', 'checkbox'],
  },
  {
    id: 'inputDisabled',
    label: '비활성화',
    description: '입력 요소가 비활성화되어 있는지 확인합니다',
    category: 'form',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: 'attribute',
    tags: ['form', 'disabled'],
  },
  {
    id: 'inputEnabled',
    label: '활성화',
    description: '입력 요소가 활성화되어 있는지 확인합니다',
    category: 'form',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: null,
    tags: ['form', 'enabled'],
  },
  {
    id: 'inputValue',
    label: '입력 값 확인',
    description: '입력 요소의 현재 값을 확인합니다',
    category: 'form',
    elementRequirement: 'required',
    params: [
      {
        name: 'value',
        label: '기대 값',
        type: 'string',
        required: true,
        placeholder: '기대하는 입력 값',
      },
    ],
    mappedAssertionType: null,
    tags: ['form', 'input', 'value'],
  },
  {
    id: 'inputReadonly',
    label: '읽기전용',
    description: '입력 요소가 읽기전용인지 확인합니다',
    category: 'form',
    elementRequirement: 'required',
    params: [],
    mappedAssertionType: 'attribute',
    tags: ['form', 'readonly'],
  },

  // ── Page (4) ───────────────────────────────────────────────────────────
  {
    id: 'currentUrl',
    label: 'URL 확인',
    description: '현재 페이지 URL을 확인합니다',
    category: 'page',
    elementRequirement: 'none',
    params: [
      {
        name: 'url',
        label: '기대 URL',
        type: 'string',
        required: true,
        placeholder: 'https://...',
      },
      {
        name: 'matchType',
        label: '매칭 방식',
        type: 'select',
        required: false,
        defaultValue: 'contains',
        options: [
          { label: '포함', value: 'contains' },
          { label: '정확히 일치', value: 'exact' },
          { label: '정규식', value: 'regex' },
        ],
      },
    ],
    mappedAssertionType: null,
    tags: ['page', 'url'],
  },
  {
    id: 'pageTitle',
    label: '제목 확인',
    description: '페이지 제목을 확인합니다',
    category: 'page',
    elementRequirement: 'none',
    params: [
      {
        name: 'title',
        label: '기대 제목',
        type: 'string',
        required: true,
        placeholder: '페이지 제목',
      },
    ],
    mappedAssertionType: null,
    tags: ['page', 'title'],
  },
  {
    id: 'documentExists',
    label: '문서 로딩 확인',
    description: '페이지 문서가 정상적으로 로딩되었는지 확인합니다',
    category: 'page',
    elementRequirement: 'none',
    params: [],
    mappedAssertionType: null,
    tags: ['page', 'document'],
  },
  {
    id: 'cssStyle',
    label: '특정 스타일 확인',
    description: '요소의 계산된 CSS 스타일 값을 확인합니다',
    category: 'page',
    elementRequirement: 'required',
    params: [
      { name: 'property', label: 'CSS 속성', type: 'string', required: true, placeholder: 'color' },
      {
        name: 'value',
        label: '기대 값',
        type: 'string',
        required: true,
        placeholder: 'rgb(0, 0, 0)',
      },
    ],
    mappedAssertionType: null,
    tags: ['page', 'style', 'css'],
  },

  // ── API (2) ────────────────────────────────────────────────────────────
  {
    id: 'apiResponse',
    label: 'API 응답 확인',
    description: 'API 응답의 상태 코드와 본문을 확인합니다',
    category: 'api',
    elementRequirement: 'none',
    params: [
      { name: 'url', label: 'API URL', type: 'string', required: true, placeholder: '/api/users' },
      {
        name: 'method',
        label: 'HTTP 메서드',
        type: 'select',
        required: false,
        defaultValue: 'GET',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
        ],
      },
      { name: 'status', label: '상태 코드', type: 'number', required: false, defaultValue: 200 },
      {
        name: 'jsonPath',
        label: 'JSONPath',
        type: 'string',
        required: false,
        placeholder: '$.data.id',
      },
      { name: 'expectedValue', label: '기대 값', type: 'string', required: false },
    ],
    mappedAssertionType: 'assertApi',
    tags: ['api', 'response'],
  },
  {
    id: 'apiCalled',
    label: 'API 호출 여부',
    description: '특정 API가 호출되었는지 확인합니다',
    category: 'api',
    elementRequirement: 'none',
    params: [
      { name: 'url', label: 'API URL', type: 'string', required: true, placeholder: '/api/users' },
      {
        name: 'method',
        label: 'HTTP 메서드',
        type: 'select',
        required: false,
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
        ],
      },
    ],
    mappedAssertionType: 'assertApi',
    tags: ['api', 'called'],
  },
];

/** Get verifications filtered by category */
export const getVerificationsByCategory = (
  category: VerificationCategory
): VerificationCatalogEntry[] => VERIFICATION_CATALOG.filter((v) => v.category === category);

/** Find a verification by its ID */
export const getVerificationById = (id: string): VerificationCatalogEntry | undefined =>
  VERIFICATION_CATALOG.find((v) => v.id === id);
