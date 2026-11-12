import { describe, expect, it } from 'vitest';
import { MathsError } from '../maths/parser';
import { compileCustom, inspectCustom, MAX_TERMS, parseList, type CustomDef } from './custom';

function take(def: CustomDef, n: number): number[] {
  const out: number[] = [];
  for (const v of compileCustom(def).generate()) {
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

describe('custom sets', () => {
  it('formula in n', () => {
    expect(take({ kind: 'formula', expr: 'n^2 + 1' }, 5)).toEqual([2, 5, 10, 17, 26]);
    expect(take({ kind: 'formula', expr: 'floor(n π)' }, 4)).toEqual([3, 6, 9, 12]);
  });

  it('rule using earlier terms, with starting values', () => {
    const fib: CustomDef = { kind: 'recurrence', expr: 'a(n-1) + a(n-2)', starts: '1, 1' };
    expect(take(fib, 10)).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55]);
    expect(take({ kind: 'recurrence', expr: '2a(n-1) + n', starts: '1' }, 4)).toEqual([1, 4, 11, 26]);
  });

  it('pasted list', () => {
    expect(take({ kind: 'list', text: '3, 1 4\n1;5' }, 10)).toEqual([3, 1, 4, 1, 5]);
    expect(parseList('1e3 20')).toEqual([1000, 20]);
  });

  it('never gives more than the cap', () => {
    let count = 0;
    for (const _ of compileCustom({ kind: 'formula', expr: 'n' }).generate()) count++;
    expect(count).toBe(MAX_TERMS);
    expect(() => parseList(Array(MAX_TERMS + 1).fill('1').join(' '))).toThrow(MathsError);
  });
});

describe('custom sets: bad input is explained, not played', () => {
  const problem = (def: CustomDef): string => {
    const check = inspectCustom(def);
    expect(check.ok).toBe(false);
    return check.error ?? '';
  };

  it('non-whole numbers', () => {
    expect(problem({ kind: 'formula', expr: 'n/2' })).toMatch(/whole numbers/);
    expect(problem({ kind: 'list', text: '1 2.5 3' })).toMatch(/whole numbers/);
  });

  it('negative numbers', () => {
    expect(problem({ kind: 'formula', expr: '5 - n' })).toMatch(/negative/);
    expect(problem({ kind: 'list', text: '4 -2' })).toMatch(/negative/);
  });

  it('things that are not numbers', () => {
    expect(problem({ kind: 'list', text: '1 two 3' })).toMatch(/not a number/);
    expect(problem({ kind: 'list', text: '' })).toMatch(/numbers to begin/);
    expect(problem({ kind: 'formula', expr: '0/0 + n' })).toMatch(/divide by zero/);
  });

  it('huge numbers from the very first term', () => {
    expect(problem({ kind: 'formula', expr: '10^30' })).toMatch(/too large/);
    expect(problem({ kind: 'list', text: '99999999999999999999' })).toMatch(/too large/);
  });

  it('rules without enough starting values, or with no earlier terms', () => {
    expect(problem({ kind: 'recurrence', expr: 'a(n-1) + a(n-2)', starts: '1' })).toMatch(/2 starting values/);
    expect(problem({ kind: 'recurrence', expr: 'n + 1', starts: '1' })).toMatch(/Formula/);
  });

  it('sets that grow too large simply end, with a note', () => {
    const check = inspectCustom({ kind: 'formula', expr: '2^n' });
    expect(check.ok).toBe(true);
    expect(check.endsAfter).toBe(52);
    const fact = inspectCustom({ kind: 'formula', expr: 'n!' });
    expect(fact.ok).toBe(true);
    expect(fact.endsAfter).toBe(18);
  });

  it('good input passes with a preview', () => {
    const check = inspectCustom({ kind: 'formula', expr: 'n^2 + 1' });
    expect(check.ok).toBe(true);
    expect(check.preview.slice(0, 3)).toEqual([2, 5, 10]);
    expect(check.tex).toContain('a_n');
  });
});
