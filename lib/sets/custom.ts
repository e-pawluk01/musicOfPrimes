import { evaluate, lookback, MathsError, parse, toTex } from '../maths/parser';
import { MAX_VALUE } from './types';

/** A set the user defines: a formula in n, a rule using earlier terms, or a pasted list. */
export type CustomDef =
  | { kind: 'formula'; expr: string }
  | { kind: 'recurrence'; expr: string; starts: string }
  | { kind: 'list'; text: string };

export const MAX_TERMS = 50_000;

const ordinal = (i: number): string => `Term ${i.toLocaleString('en-GB')}`;

/** Checks one term is usable: a whole number, not negative, not too large. */
function checkTerm(value: number, index: number): number {
  if (Number.isNaN(value)) throw new MathsError(`${ordinal(index)} is not a number.`);
  if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE) {
    throw new MathsError(`${ordinal(index)} is too large to place accurately.`, true);
  }
  if (value < 0) {
    throw new MathsError(`${ordinal(index)} comes out as ${value}. Terms can't be negative.`);
  }
  if (!Number.isInteger(value)) {
    const shown = Number(value.toPrecision(6));
    throw new MathsError(
      `${ordinal(index)} comes out as ${shown}. Terms must be whole numbers. Try putting floor( ) around the formula.`,
    );
  }
  return value;
}

/** Reads a list of numbers separated by commas, spaces or new lines. */
export function parseList(text: string): number[] {
  const parts = text.split(/[\s,;]+/).filter((p) => p.length > 0);
  if (parts.length === 0) throw new MathsError('Paste or type some numbers to begin.');
  if (parts.length > MAX_TERMS) {
    throw new MathsError(`That is ${parts.length.toLocaleString('en-GB')} numbers. The most allowed is ${MAX_TERMS.toLocaleString('en-GB')}.`);
  }
  return parts.map((part, i) => {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e\+?\d+)?$/i.test(part)) {
      throw new MathsError(`"${part.slice(0, 20)}" is not a number.`);
    }
    return checkTerm(Number(part), i + 1);
  });
}

export interface CompiledSet {
  /** The rule as TeX, for the typeset preview. */
  tex: string;
  generate: () => Generator<number, void, void>;
}

/**
 * Turns a definition into a term generator.
 * Throws a MathsError in plain words if the definition can't be read.
 * The generator itself throws a MathsError if a term turns out unusable.
 */
export function compileCustom(def: CustomDef): CompiledSet {
  if (def.kind === 'list') {
    const values = parseList(def.text);
    const shown = values.slice(0, 6).join(', ');
    return {
      tex: String.raw`\left(${shown}${values.length > 6 ? String.raw`, \ldots` : ''}\right)`,
      *generate() {
        yield* values;
      },
    };
  }

  if (def.kind === 'formula') {
    const tree = parse(def.expr);
    return {
      tex: `a_n = ${toTex(tree)}`,
      *generate() {
        for (let n = 1; n <= MAX_TERMS; n++) yield checkTerm(evaluate(tree, { n }), n);
      },
    };
  }

  const tree = parse(def.expr, { allowPrev: true });
  const starts = def.starts.trim() === '' ? [] : parseList(def.starts);
  const back = lookback(tree);
  if (back === 0) {
    throw new MathsError('A rule should use earlier terms, like a(n-1). For a plain formula, use the "Formula" tab.');
  }
  if (starts.length < back) {
    throw new MathsError(
      `This rule looks back ${back} term${back === 1 ? '' : 's'}, so it needs at least ${back} starting value${back === 1 ? '' : 's'}.`,
    );
  }
  const startTex = starts
    .slice(0, 4)
    .map((v, i) => `a_{${i + 1}} = ${v}`)
    .join(String.raw`,\ `);
  return {
    tex: String.raw`a_n = ${toTex(tree)}, \quad ${startTex}${starts.length > 4 ? String.raw`,\ \ldots` : ''}`,
    *generate() {
      const history = starts.slice();
      yield* starts;
      for (let n = starts.length + 1; n <= MAX_TERMS; n++) {
        const value = checkTerm(
          evaluate(tree, { n, prev: (k) => history[history.length - k] }),
          n,
        );
        history.push(value);
        if (history.length > 16) history.shift();
        yield value;
      }
    },
  };
}

export interface CustomCheck {
  ok: boolean;
  tex: string;
  /** The first few terms. */
  preview: number[];
  /** What is wrong, in plain words. */
  error?: string;
  /** Set when the terms stop early because they get too large. */
  endsAfter?: number;
}

/** Tries a definition out on its first terms, so problems show before playing. */
export function inspectCustom(def: CustomDef, check = 500, show = 10): CustomCheck {
  let compiled: CompiledSet;
  try {
    compiled = compileCustom(def);
  } catch (e) {
    return { ok: false, tex: '', preview: [], error: messageOf(e) };
  }
  const preview: number[] = [];
  let count = 0;
  try {
    for (const value of compiled.generate()) {
      if (preview.length < show) preview.push(value);
      if (++count >= check) break;
    }
  } catch (e) {
    const tooBig = e instanceof MathsError && e.tooBig;
    if (tooBig && count > 0) return { ok: true, tex: compiled.tex, preview, endsAfter: count };
    return { ok: false, tex: compiled.tex, preview, error: messageOf(e) };
  }
  if (count === 0) return { ok: false, tex: compiled.tex, preview, error: 'This gives no terms.' };
  return { ok: true, tex: compiled.tex, preview };
}

function messageOf(e: unknown): string {
  return e instanceof MathsError ? e.message : 'Something went wrong reading that.';
}
