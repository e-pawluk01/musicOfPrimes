/**
 * A small, safe maths reader. It only understands numbers, n, π, a few named
 * functions and the usual signs. Nothing typed here is ever run as code.
 */

export class MathsError extends Error {
  /** True when the only problem is that a number got too large. */
  readonly tooBig: boolean;
  constructor(message: string, tooBig = false) {
    super(message);
    this.name = 'MathsError';
    this.tooBig = tooBig;
  }
}

export type FnName = 'sqrt' | 'floor' | 'ceil' | 'abs' | 'round';
export type BinOp = '+' | '-' | '*' | '/' | '^' | 'mod';

export type Node =
  | { t: 'num'; v: number }
  | { t: 'n' }
  | { t: 'pi' }
  | { t: 'prev'; k: number }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: BinOp; a: Node; b: Node; implicit?: boolean }
  | { t: 'fact'; a: Node }
  | { t: 'call'; fn: FnName; a: Node };

type Token =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string };

const FUNCTIONS: readonly string[] = ['sqrt', 'floor', 'ceil', 'abs', 'round'];
const WORDS: readonly string[] = [...FUNCTIONS, 'mod', 'pi', 'n', 'a'];
const MAX_LENGTH = 200;
const MAX_DEPTH = 40;
export const MAX_LOOKBACK = 10;

function tokenize(input: string): Token[] {
  if (input.length > MAX_LENGTH) {
    throw new MathsError(`That is too long. Keep it under ${MAX_LENGTH} characters.`);
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const text = input.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) {
        throw new MathsError(`"${text}" is not a number I can read.`);
      }
      tokens.push({ k: 'num', v: Number(text) });
      i = j;
    } else if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
      // Split runs of letters into known words, so "nmod" or "npi" still work.
      let rest = input.slice(i, j).toLowerCase();
      while (rest.length > 0) {
        const word = WORDS.find((w) => rest.startsWith(w));
        if (!word) {
          throw new MathsError(
            `I don't know what "${input.slice(i, j)}" means. Use n for the position in the list.`,
          );
        }
        tokens.push({ k: 'id', v: word });
        rest = rest.slice(word.length);
      }
      i = j;
    } else if (ch === 'π') {
      tokens.push({ k: 'id', v: 'pi' });
      i++;
    } else if (ch === '√') {
      tokens.push({ k: 'id', v: 'sqrt' });
      i++;
    } else if (ch === '⌊') {
      tokens.push({ k: 'id', v: 'floor' }, { k: 'op', v: '(' });
      i++;
    } else if (ch === '⌋') {
      tokens.push({ k: 'op', v: ')' });
      i++;
    } else if ('+-*/^()!%'.includes(ch)) {
      tokens.push(ch === '%' ? { k: 'id', v: 'mod' } : { k: 'op', v: ch });
      i++;
    } else if (ch === '−' || ch === '–') {
      tokens.push({ k: 'op', v: '-' });
      i++;
    } else if (ch === '×' || ch === '·') {
      tokens.push({ k: 'op', v: '*' });
      i++;
    } else if (ch === '÷') {
      tokens.push({ k: 'op', v: '/' });
      i++;
    } else {
      throw new MathsError(`I can't use the symbol "${ch}" here.`);
    }
  }
  return tokens;
}

export interface ParseOptions {
  /** Allow a(n-1), a(n-2)… to refer to earlier terms. */
  allowPrev?: boolean;
}

/** Reads a formula and returns its structure. Throws a MathsError in plain words if it can't. */
export function parse(input: string, options: ParseOptions = {}): Node {
  const tokens = tokenize(input);
  if (tokens.length === 0) throw new MathsError('Type a formula to begin.');
  let pos = 0;
  let depth = 0;

  const peek = (): Token | undefined => tokens[pos];
  const isOp = (v: string): boolean => {
    const t = tokens[pos];
    return t !== undefined && t.k === 'op' && t.v === v;
  };
  const isWord = (v: string): boolean => {
    const t = tokens[pos];
    return t !== undefined && t.k === 'id' && t.v === v;
  };
  const expectOp = (v: string, message: string): void => {
    if (!isOp(v)) throw new MathsError(message);
    pos++;
  };
  const describe = (t: Token | undefined): string =>
    t === undefined ? 'the end' : `"${t.k === 'num' ? t.v : t.v}"`;

  function expr(): Node {
    if (++depth > MAX_DEPTH) throw new MathsError('That has too many brackets inside brackets.');
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { v: string }).v as BinOp;
      left = { t: 'bin', op, a: left, b: term() };
    }
    depth--;
    return left;
  }

  function term(): Node {
    let left = unary();
    for (;;) {
      const t = peek();
      if (isOp('*') || isOp('/')) {
        const op = (tokens[pos++] as { v: string }).v as BinOp;
        left = { t: 'bin', op, a: left, b: unary() };
      } else if (isWord('mod')) {
        pos++;
        left = { t: 'bin', op: 'mod', a: left, b: unary() };
      } else if (t !== undefined && (t.k === 'id' || (t.k === 'op' && t.v === '('))) {
        // Things written side by side are multiplied: 2n, n(n+1).
        left = { t: 'bin', op: '*', a: left, b: power(), implicit: true };
      } else if (t !== undefined && t.k === 'num') {
        throw new MathsError(`There is a sign missing before ${describe(t)}.`);
      } else {
        return left;
      }
    }
  }

  function unary(): Node {
    if (isOp('-')) {
      pos++;
      if (++depth > MAX_DEPTH) throw new MathsError('That has too many minus signs in a row.');
      const a = unary();
      depth--;
      return { t: 'neg', a };
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return power();
  }

  function power(): Node {
    const base = postfix();
    if (isOp('^')) {
      pos++;
      if (++depth > MAX_DEPTH) throw new MathsError('That has too many powers on top of powers.');
      const exponent = unary();
      depth--;
      return { t: 'bin', op: '^', a: base, b: exponent };
    }
    return base;
  }

  function postfix(): Node {
    let node = primary();
    while (isOp('!')) {
      pos++;
      node = { t: 'fact', a: node };
    }
    return node;
  }

  function primary(): Node {
    const t = peek();
    if (t === undefined) throw new MathsError('The formula stops too early. Something is missing at the end.');
    pos++;
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'op') {
      if (t.v === '(') {
        const inner = expr();
        expectOp(')', 'A closing bracket ")" is missing.');
        return inner;
      }
      if (t.v === ')') throw new MathsError('There is a closing bracket ")" with nothing to close.');
      throw new MathsError(`The sign "${t.v}" is in a place where a number should be.`);
    }
    if (t.v === 'n') return { t: 'n' };
    if (t.v === 'pi') return { t: 'pi' };
    if (t.v === 'mod') throw new MathsError('"mod" needs a number on both sides, like n mod 3.');
    if (t.v === 'a') {
      if (!options.allowPrev) {
        throw new MathsError('Earlier terms like a(n-1) only work in the "Rule" tab.');
      }
      const help = 'Write earlier terms as a(n-1), a(n-2) and so on.';
      expectOp('(', help);
      if (!isWord('n')) throw new MathsError(help);
      pos++;
      expectOp('-', help);
      const k = peek();
      if (k === undefined || k.k !== 'num' || !Number.isInteger(k.v) || k.v < 1) {
        throw new MathsError(help);
      }
      if (k.v > MAX_LOOKBACK) {
        throw new MathsError(`A rule can look back at most ${MAX_LOOKBACK} terms.`);
      }
      pos++;
      expectOp(')', help);
      return { t: 'prev', k: k.v };
    }
    // A named function such as sqrt( … ).
    expectOp('(', `"${t.v}" needs brackets after it, like ${t.v}(n).`);
    const inner = expr();
    expectOp(')', 'A closing bracket ")" is missing.');
    return { t: 'call', fn: t.v as FnName, a: inner };
  }

  const tree = expr();
  if (pos < tokens.length) {
    const t = tokens[pos];
    if (t.k === 'op' && t.v === ')') {
      throw new MathsError('There is a closing bracket ")" with nothing to close.');
    }
    throw new MathsError(`I did not expect ${describe(t)} there.`);
  }
  return tree;
}

export interface Scope {
  n: number;
  /** The term k places back. */
  prev?: (k: number) => number;
}

function factorial(x: number): number {
  if (!Number.isInteger(x) || x < 0) {
    throw new MathsError('A factorial (!) only works on whole numbers from 0 upwards.');
  }
  if (x > 170) throw new MathsError('That factorial is too large to work out.', true);
  let result = 1;
  for (let i = 2; i <= x; i++) result *= i;
  return result;
}

/** Works out the value of a formula. Throws a MathsError in plain words if it can't. */
export function evaluate(node: Node, scope: Scope): number {
  const value = walk(node, scope);
  if (Number.isNaN(value)) throw new MathsError('The result is not a number.');
  if (!Number.isFinite(value)) throw new MathsError('The result is too large.', true);
  return value;
}

function walk(node: Node, scope: Scope): number {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'n':
      return scope.n;
    case 'pi':
      return Math.PI;
    case 'prev':
      if (!scope.prev) throw new MathsError('Earlier terms are not available here.');
      return scope.prev(node.k);
    case 'neg':
      return -walk(node.a, scope);
    case 'fact':
      return factorial(walk(node.a, scope));
    case 'call': {
      const x = walk(node.a, scope);
      switch (node.fn) {
        case 'sqrt':
          if (x < 0) throw new MathsError("You can't take the square root of a negative number.");
          return Math.sqrt(x);
        case 'floor':
          return Math.floor(x);
        case 'ceil':
          return Math.ceil(x);
        case 'abs':
          return Math.abs(x);
        case 'round':
          return Math.round(x);
      }
      throw new MathsError('Unknown function.');
    }
    case 'bin': {
      const a = walk(node.a, scope);
      const b = walk(node.b, scope);
      switch (node.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          if (b === 0) throw new MathsError("You can't divide by zero.");
          return a / b;
        case '^':
          return Math.pow(a, b);
        case 'mod':
          if (b === 0) throw new MathsError("You can't take mod zero.");
          return ((a % b) + b) % b;
      }
    }
  }
  throw new MathsError('I could not work that out.');
}

/** The furthest back a rule looks (0 if it never uses earlier terms). */
export function lookback(node: Node): number {
  switch (node.t) {
    case 'prev':
      return node.k;
    case 'neg':
    case 'fact':
    case 'call':
      return lookback(node.a);
    case 'bin':
      return Math.max(lookback(node.a), lookback(node.b));
    default:
      return 0;
  }
}

const paren = (s: string): string => String.raw`\left(${s}\right)`;
const isSum = (n: Node): boolean => n.t === 'bin' && (n.op === '+' || n.op === '-');
const isAtom = (n: Node): boolean =>
  n.t === 'num' || n.t === 'n' || n.t === 'pi' || n.t === 'prev' || n.t === 'call';

/** Writes a formula as TeX, so it can be shown as typeset maths. */
export function toTex(node: Node): string {
  switch (node.t) {
    case 'num':
      return String(node.v);
    case 'n':
      return 'n';
    case 'pi':
      return String.raw`\pi`;
    case 'prev':
      return `a_{n-${node.k}}`;
    case 'neg':
      return `-${isSum(node.a) ? paren(toTex(node.a)) : toTex(node.a)}`;
    case 'fact':
      return `${isAtom(node.a) ? toTex(node.a) : paren(toTex(node.a))}!`;
    case 'call': {
      const a = toTex(node.a);
      switch (node.fn) {
        case 'sqrt':
          return String.raw`\sqrt{${a}}`;
        case 'floor':
          return String.raw`\left\lfloor ${a} \right\rfloor`;
        case 'ceil':
          return String.raw`\left\lceil ${a} \right\rceil`;
        case 'abs':
          return String.raw`\left| ${a} \right|`;
        default:
          return String.raw`\operatorname{round}${paren(a)}`;
      }
    }
    case 'bin': {
      const { op, a, b } = node;
      if (op === '+') return `${toTex(a)} + ${toTex(b)}`;
      if (op === '-') return `${toTex(a)} - ${isSum(b) ? paren(toTex(b)) : toTex(b)}`;
      if (op === '/') return String.raw`\frac{${toTex(a)}}{${toTex(b)}}`;
      if (op === '^') {
        return `{${isAtom(a) && a.t !== 'prev' ? toTex(a) : paren(toTex(a))}}^{${toTex(b)}}`;
      }
      const wrap = (x: Node): string =>
        isSum(x) || x.t === 'neg' || (x.t === 'bin' && x.op === 'mod') ? paren(toTex(x)) : toTex(x);
      if (op === 'mod') return String.raw`${wrap(a)} \bmod ${wrap(b)}`;
      // Multiplication: side by side where that reads clearly, otherwise a dot.
      const dot = !node.implicit || b.t === 'num' || (b.t === 'bin' && b.op === '^' && b.a.t === 'num');
      return `${wrap(a)}${dot ? String.raw` \cdot ` : ' '}${wrap(b)}`;
    }
  }
}
