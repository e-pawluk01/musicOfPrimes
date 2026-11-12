'use client';

import { useMemo, useRef } from 'react';
import { inspectCustom, type CustomDef } from '../lib/sets/custom';
import { Segmented } from './Segmented';
import { Tex } from './Tex';

/** What the editor holds while typing: all three tabs keep their own text. */
export interface CustomDraft {
  kind: CustomDef['kind'];
  formula: string;
  rule: string;
  starts: string;
  list: string;
}

export const DEFAULT_DRAFT: CustomDraft = {
  kind: 'formula',
  formula: 'n^2 + 1',
  rule: 'a(n-1) + a(n-2)',
  starts: '1, 1',
  list: '3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5',
};

export function draftToDef(d: CustomDraft): CustomDef {
  if (d.kind === 'formula') return { kind: 'formula', expr: d.formula };
  if (d.kind === 'recurrence') return { kind: 'recurrence', expr: d.rule, starts: d.starts };
  return { kind: 'list', text: d.list };
}

interface SymbolButton {
  label: string;
  title: string;
  /** Text placed before and after the cursor (or around the selection). */
  before: string;
  after: string;
}

const SYMBOLS: SymbolButton[] = [
  { label: String.raw`\tfrac{a}{b}`, title: 'Fraction', before: '(', after: ')/()' },
  { label: String.raw`x^{y}`, title: 'Power', before: '^', after: '' },
  { label: String.raw`\sqrt{x}`, title: 'Square root', before: 'sqrt(', after: ')' },
  { label: String.raw`x!`, title: 'Factorial', before: '!', after: '' },
  { label: String.raw`\mathrm{mod}`, title: 'Remainder (mod)', before: ' mod ', after: '' },
  { label: String.raw`\lfloor x \rfloor`, title: 'Round down (floor)', before: 'floor(', after: ')' },
  { label: String.raw`\pi`, title: 'Pi', before: 'π', after: '' },
];

const KINDS: { value: CustomDef['kind']; label: string }[] = [
  { value: 'formula', label: 'Formula' },
  { value: 'recurrence', label: 'Rule' },
  { value: 'list', label: 'List' },
];

const format = new Intl.NumberFormat('en-GB');

interface Props {
  draft: CustomDraft;
  onChange: (draft: CustomDraft) => void;
  /** Called with a definition that has passed its checks. */
  onUse: (def: CustomDef, tex: string) => void;
}

export function CustomEditor({ draft, onChange, onUse }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const def = useMemo(() => draftToDef(draft), [draft]);
  const check = useMemo(() => inspectCustom(def), [def]);
  const field = draft.kind === 'formula' ? 'formula' : 'rule';

  const insert = (symbol: SymbolButton) => {
    const el = inputRef.current;
    if (!el) return;
    const text = draft[field];
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const selected = text.slice(start, end);
    const next = text.slice(0, start) + symbol.before + selected + symbol.after + text.slice(end);
    onChange({ ...draft, [field]: next });
    const cursor = start + symbol.before.length + selected.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="custom">
      <Segmented
        label="Kind of custom set"
        options={KINDS}
        value={draft.kind}
        onChange={(kind) => onChange({ ...draft, kind })}
      />

      {draft.kind !== 'list' && (
        <>
          <label className="field">
            <span className="field-label">
              {draft.kind === 'formula' ? 'Formula for term n' : 'Rule for term n, using earlier terms'}
            </span>
            <div className="field-row">
              <span className="field-prefix">a(n) =</span>
              <input
                ref={inputRef}
                className="text-input"
                type="text"
                inputMode="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={200}
                value={draft[field]}
                onChange={(e) => onChange({ ...draft, [field]: e.target.value })}
              />
            </div>
          </label>
          <div className="symbols" role="group" aria-label="Maths symbols">
            {SYMBOLS.map((s) => (
              <button
                key={s.title}
                type="button"
                className="symbol"
                title={s.title}
                aria-label={s.title}
                onClick={() => insert(s)}
              >
                <Tex tex={s.label} />
              </button>
            ))}
          </div>
          {draft.kind === 'recurrence' && (
            <label className="field">
              <span className="field-label">Starting values, in order</span>
              <input
                className="text-input"
                type="text"
                inputMode="text"
                spellCheck={false}
                maxLength={200}
                value={draft.starts}
                onChange={(e) => onChange({ ...draft, starts: e.target.value })}
              />
            </label>
          )}
          <p className="hint">
            {draft.kind === 'formula'
              ? 'n counts 1, 2, 3 … Write earlier terms in the Rule tab.'
              : 'Write earlier terms as a(n-1), a(n-2) and so on.'}
          </p>
        </>
      )}

      {draft.kind === 'list' && (
        <label className="field">
          <span className="field-label">Numbers, separated by commas, spaces or new lines</span>
          <textarea
            className="text-input text-area"
            rows={4}
            spellCheck={false}
            value={draft.list}
            onChange={(e) => onChange({ ...draft, list: e.target.value })}
          />
        </label>
      )}

      <div className="preview" aria-live="polite">
        {check.tex && <Tex tex={check.tex} className="preview-tex" />}
        {check.preview.length > 0 && (
          <p className="preview-terms">
            {check.preview.map((v) => format.format(v)).join(', ')}
            {check.ok && check.endsAfter === undefined ? ', …' : ''}
          </p>
        )}
        {check.error && <p className="error">{check.error}</p>}
        {check.ok && check.endsAfter !== undefined && (
          <p className="hint">
            Ends after {format.format(check.endsAfter)} terms: after that the numbers are too large
            to place accurately.
          </p>
        )}
      </div>

      <button
        type="button"
        className="button"
        disabled={!check.ok}
        onClick={() => onUse(def, check.tex)}
      >
        Use this set
      </button>
    </div>
  );
}
