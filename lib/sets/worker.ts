// Runs in the background so finding terms never freezes the screen.
import { compileCustom, type CustomDef } from './custom';
import { getSet } from './index';
import { MAX_VALUE } from './types';

export type SetSource = { type: 'builtin'; id: string } | { type: 'custom'; def: CustomDef };

export type WorkerRequest =
  | { type: 'reset'; source: SetSource; runId: number }
  | { type: 'more'; count: number; runId: number };

export interface WorkerResponse {
  runId: number;
  terms: Float64Array;
  /** True when the set has no more usable terms. */
  done: boolean;
}

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

function* nothing(): Generator<number, void, void> {}

function open(source: SetSource): Generator<number, void, void> {
  try {
    if (source.type === 'builtin') return getSet(source.id).generate();
    return compileCustom(source.def).generate();
  } catch {
    return nothing();
  }
}

let gen = nothing();
let done = true;

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'reset') {
    gen = open(msg.source);
    done = false;
    return;
  }
  const out = new Float64Array(msg.count);
  let n = 0;
  try {
    while (n < msg.count && !done) {
      const next = gen.next();
      if (next.done || !Number.isFinite(next.value) || Math.abs(next.value) > MAX_VALUE) {
        done = true;
        break;
      }
      out[n++] = next.value;
    }
  } catch {
    // A custom set hit a term it can't use: the set simply ends there.
    done = true;
  }
  const terms = out.slice(0, n);
  scope.postMessage({ runId: msg.runId, terms, done }, [terms.buffer]);
};
