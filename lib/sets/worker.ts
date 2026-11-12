// Runs in the background so finding terms never freezes the screen.
import { getSet } from './index';
import { MAX_VALUE } from './types';

export type WorkerRequest =
  | { type: 'reset'; setId: string; runId: number }
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

let gen: Generator<number, void, void> = getSet('primes').generate();
let done = false;

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'reset') {
    gen = getSet(msg.setId).generate();
    done = false;
    return;
  }
  const out = new Float64Array(msg.count);
  let n = 0;
  while (n < msg.count && !done) {
    const next = gen.next();
    if (next.done || !Number.isFinite(next.value) || Math.abs(next.value) > MAX_VALUE) {
      done = true;
      break;
    }
    out[n++] = next.value;
  }
  const terms = out.slice(0, n);
  scope.postMessage({ runId: msg.runId, terms, done }, [terms.buffer]);
};
