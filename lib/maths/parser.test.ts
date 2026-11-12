import { describe, expect, it } from 'vitest';
import { evaluate, MathsError, parse, toTex } from './parser';

const calc = (text: string, n = 1): number => evaluate(parse(text), { n });

describe('maths reader: working things out', () => {
  it('handles the usual signs in the usual order', () => {
    expect(calc('1 + 2 * 3')).toBe(7);
    expect(calc('(1 + 2) * 3')).toBe(9);
    expect(calc('2^3^2')).toBe(512);
    expect(calc('-2^2')).toBe(-4);
    expect(calc('10 - 4 - 3')).toBe(3);
    expect(calc('7 mod 3')).toBe(1);
    expect(calc('-1 mod 3')).toBe(2);
    expect(calc('5!')).toBe(120);
    expect(calc('sqrt(49)')).toBe(7);
    expect(calc('floor(7/2)')).toBe(3);
    expect(calc('π')).toBeCloseTo(Math.PI, 12);
  });

  it('uses n, and multiplies things written side by side', () => {
    expect(calc('n^2 + 1', 4)).toBe(17);
    expect(calc('2n', 5)).toBe(10);
    expect(calc('n(n+1)/2', 4)).toBe(10);
    expect(calc('2n^2', 3)).toBe(18);
    expect(calc('(n+1)(n-1)', 5)).toBe(24);
    expect(calc('floor(n π)', 2)).toBe(6);
  });

  it('reads earlier terms only when allowed', () => {
    const tree = parse('a(n-1) + a(n-2)', { allowPrev: true });
    expect(evaluate(tree, { n: 3, prev: (k) => (k === 1 ? 5 : 3) })).toBe(8);
    expect(() => parse('a(n-1)')).toThrow(MathsError);
    expect(() => parse('a(n+1)', { allowPrev: true })).toThrow(MathsError);
    expect(() => parse('a(n-99)', { allowPrev: true })).toThrow(MathsError);
  });

  it('writes typeset maths', () => {
    expect(toTex(parse('n^2 + 1'))).toBe('{n}^{2} + 1');
    expect(toTex(parse('n(n+1)/2'))).toBe(String.raw`\frac{n \left(n + 1\right)}{2}`);
    expect(toTex(parse('sqrt(n)'))).toBe(String.raw`\sqrt{n}`);
    expect(toTex(parse('2n'))).toBe('2 n');
  });
});

describe('maths reader: safety', () => {
  const bad = [
    'alert(1)',
    'eval("1")',
    'window.location',
    'constructor',
    'n.constructor',
    '__proto__',
    'process.exit()',
    'while(true){}',
    '(() => 1)()',
    'n; n',
    'n = 5',
    'x + 1',
    '"hello"',
    '`n`',
    'n[0]',
    'import("fs")',
    'function(){}',
    '2 +',
    '(n + 1',
    'n + 1)',
    '* 3',
    '1 2',
    '',
    '   ',
    '1..2',
    'sqrt',
    'mod 3',
  ];

  it.each(bad)('refuses %j with a plain message', (text) => {
    let error: unknown;
    try {
      parse(text);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(MathsError);
    expect((error as MathsError).message.length).toBeGreaterThan(5);
  });

  it('refuses things that are too long or too deeply nested', () => {
    expect(() => parse('1+'.repeat(150) + '1')).toThrow(MathsError);
    expect(() => parse('('.repeat(60) + 'n' + ')'.repeat(60))).toThrow(MathsError);
    expect(() => parse('-'.repeat(60) + 'n')).toThrow(MathsError);
  });

  it('refuses impossible sums instead of giving nonsense', () => {
    expect(() => calc('1/0')).toThrow(MathsError);
    expect(() => calc('n mod 0')).toThrow(MathsError);
    expect(() => calc('sqrt(-1)')).toThrow(MathsError);
    expect(() => calc('(-3)!')).toThrow(MathsError);
    expect(() => calc('2.5!')).toThrow(MathsError);
    expect(() => calc('200!')).toThrow(MathsError);
    expect(() => calc('10^400')).toThrow(MathsError);
    expect(() => calc('(-8)^(1/3)')).toThrow(MathsError);
  });

  it('finishes quickly even for the largest allowed input', () => {
    const start = Date.now();
    const tree = parse('n!'.padEnd(10) + '+ n^n^n');
    for (let n = 1; n <= 5; n++) {
      try {
        evaluate(tree, { n });
      } catch {
        // Too large is fine; hanging is not.
      }
    }
    expect(Date.now() - start).toBeLessThan(200);
  });
});
