import { useState } from 'react';
import type { EventCategory } from '@like-cake/mbt-catalog';
import type { PendingStepDraft, SelectorCandidate } from './useScenarioWizard';
import { CatalogParamForm } from '../shared/CatalogParamForm';

interface StepConfigPanelProps {
  draft: PendingStepDraft;
  isInspecting: boolean;
  onSelectAction: (eventId: string) => void;
  onSelectSelector: (selector: string) => void;
  onUpdateParams: (params: Record<string, unknown>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onStartInspect: () => void;
  onManualSelector: (selector: string) => void;
}

const ACTION_OPTIONS: Array<{ label: string; eventId: string; category: EventCategory }> = [
  { label: '요소를 클릭한다', eventId: 'click', category: 'mouse' },
  { label: '텍스트를 입력한다', eventId: 'type', category: 'keyboard' },
  { label: '드롭다운을 선택한다', eventId: 'select', category: 'form' },
  { label: '키를 누른다', eventId: 'keypress', category: 'keyboard' },
  { label: '마우스를 올린다', eventId: 'hover', category: 'mouse' },
  { label: '스크롤한다', eventId: 'scroll', category: 'mouse' },
  { label: '페이지로 이동한다', eventId: 'navigate', category: 'navigation' },
  { label: '대기한다', eventId: 'wait', category: 'timing' },
  { label: '더블클릭한다', eventId: 'doubleClick', category: 'mouse' },
  { label: '파일을 업로드한다', eventId: 'fileUpload', category: 'form' },
  { label: '뒤로 간다', eventId: 'historyBack', category: 'navigation' },
  { label: '앞으로 간다', eventId: 'historyForward', category: 'navigation' },
];

type SelectorTab = 'pick' | 'manual' | 'regex';

export function StepConfigPanel({
  draft,
  isInspecting,
  onSelectAction,
  onSelectSelector,
  onUpdateParams,
  onConfirm,
  onCancel,
  onStartInspect,
  onManualSelector,
}: StepConfigPanelProps) {
  const [selectorTab, setSelectorTab] = useState<SelectorTab>('pick');
  const [manualInput, setManualInput] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const needsElement = draft.catalogEntry.elementRequirement !== 'none';
  const canConfirm = !isInspecting && (!needsElement || draft.selectedSelector);
  const parentInfo = draft.elementInfo?.parent as Record<string, unknown> | undefined;

  return (
    <div className="flex-1 overflow-y-auto" data-test-id="wizard-step-config">
      {/* ── Section: 무엇을? ── */}
      <Section title="무엇을?">
        <select
          value={draft.eventId}
          onChange={(e) => onSelectAction(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.eventId} value={opt.eventId}>
              {opt.label}
            </option>
          ))}
        </select>
      </Section>

      {/* ── Section: 파라미터 ── */}
      {draft.catalogEntry.params.length > 0 && (
        <Section title="상세 설정">
          <CatalogParamForm
            params={draft.catalogEntry.params}
            values={draft.params}
            onChange={onUpdateParams}
          />
        </Section>
      )}

      {/* ── Section: 어떤 요소를? ── */}
      {needsElement && (
        <Section
          title="어떤 요소를?"
          trailing={
            <div className="flex gap-1">
              <TabButton active={selectorTab === 'pick'} onClick={() => setSelectorTab('pick')}>화면에서 고르기</TabButton>
              <TabButton active={selectorTab === 'manual'} onClick={() => setSelectorTab('manual')}>직접 입력</TabButton>
              <TabButton active={selectorTab === 'regex'} onClick={() => setSelectorTab('regex')}>정규식 사용</TabButton>
            </div>
          }
        >
          {/* Tab: 화면에서 고르기 */}
          {selectorTab === 'pick' && (
            <div className="space-y-3">
              {isInspecting ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-sm text-orange-700">페이지에서 요소를 클릭하세요...</span>
                  <button type="button" onClick={onCancel} className="ml-auto text-xs text-gray-500 hover:text-gray-700">취소</button>
                </div>
              ) : draft.elementInfo ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onStartInspect}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    다시 선택하기
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onStartInspect}
                  className="w-full px-3 py-3 text-sm text-gray-500 border border-dashed border-gray-300 rounded-md hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  화면에서 요소를 선택하세요
                </button>
              )}

              {/* 선택된 요소 정보 */}
              {draft.elementInfo && !isInspecting && (
                <>
                  {/* 최상위 요소의 */}
                  <FieldGroup title="최상위 요소의">
                    {/* 셀렉터 후보 목록 */}
                    {draft.selectorCandidates.length > 0 && (
                      <div className="space-y-1">
                        {draft.selectorCandidates.map((c, i) => (
                          <SelectorOption
                            key={i}
                            candidate={c}
                            isSelected={draft.selectedSelector === c.selector}
                            onSelect={() => onSelectSelector(c.selector)}
                          />
                        ))}
                      </div>
                    )}
                  </FieldGroup>

                  {/* 접근성 */}
                  <FieldGroup title="접근성">
                    <div className="space-y-1.5 text-sm">
                      {Boolean(draft.elementInfo.role) && (
                        <LabelValue label="접근성 역할" value={String(draft.elementInfo.role)} />
                      )}
                      {Boolean(draft.elementInfo.ariaLabel) && (
                        <LabelValue label="접근성 이름" value={String(draft.elementInfo.ariaLabel)} />
                      )}
                      {Boolean(draft.elementInfo.testId) && (
                        <LabelValue label="Test ID" value={String(draft.elementInfo.testId)} highlight />
                      )}
                      {!draft.elementInfo.role && !draft.elementInfo.ariaLabel && (
                        <div className="text-xs text-yellow-600">접근성 속성이 없습니다</div>
                      )}
                    </div>
                  </FieldGroup>

                  {/* 보이지 않는 요소 */}
                  <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHidden}
                      onChange={(e) => setShowHidden(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">보이지 않는 요소도 찾기</span>
                    <span className="text-xs text-gray-400">ⓘ</span>
                  </label>

                  {/* 화면의 유일한 요소만 찾기 */}
                  {draft.selectedSelector && (
                    <div className="px-3 py-1.5 bg-gray-50 rounded-md text-xs text-gray-500">
                      화면의 유일한 요소만 찾기
                    </div>
                  )}

                  {/* 하위 요소의 */}
                  {parentInfo && (
                    <FieldGroup title="하위 요소의">
                      <div className="text-xs text-gray-500">
                        상위: {String(parentInfo.tagName ?? '').toLowerCase()}
                        {parentInfo.id ? `#${String(parentInfo.id)}` : ''}
                        {parentInfo.classNames ? `.${String((parentInfo.classNames as string[])?.join('.'))}` : ''}
                      </div>
                    </FieldGroup>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab: 직접 입력 */}
          {selectorTab === 'manual' && (
            <div className="space-y-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="CSS 셀렉터 입력 (예: #login-btn, .submit)"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualInput.trim()) {
                    onManualSelector(manualInput.trim());
                  }
                }}
                disabled={!manualInput.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                적용
              </button>
            </div>
          )}

          {/* Tab: 정규식 사용 */}
          {selectorTab === 'regex' && (
            <div className="space-y-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="정규식 패턴 (예: button.*submit)"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-[10px] text-gray-400">
                XPath contains() 패턴으로 변환됩니다
              </div>
              <button
                type="button"
                onClick={() => {
                  if (manualInput.trim()) {
                    // Convert regex-like pattern to xpath contains
                    const xpath = `//*[contains(@class, "${manualInput.trim()}") or contains(text(), "${manualInput.trim()}")]`;
                    onManualSelector(`xpath:${xpath}`);
                  }
                }}
                disabled={!manualInput.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                적용
              </button>
            </div>
          )}
        </Section>
      )}

      {/* ── Footer Actions ── */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            canConfirm
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          스텝 추가
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Section({ title, trailing, children }: { title: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
        {title}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function LabelValue({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-mono ${highlight ? 'text-green-600 font-medium' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function SelectorOption({ candidate, isSelected, onSelect }: { candidate: SelectorCandidate; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-2.5 py-1.5 text-left rounded-md transition-colors ${
        isSelected
          ? 'bg-blue-50 border border-blue-300'
          : 'bg-white border border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500">{candidate.strategy}</span>
        <div className="flex items-center gap-1">
          {candidate.isUnique && <span className="text-[9px] text-green-600">unique</span>}
          <span className="text-[9px] text-gray-400">{candidate.score}</span>
        </div>
      </div>
      <div className="text-xs font-mono text-gray-700 truncate mt-0.5">{candidate.selector}</div>
    </button>
  );
}
