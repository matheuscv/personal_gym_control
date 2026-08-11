import type { SessionSetPatch } from './types';

const STORAGE_KEY = 'pgc:offline-queue:session-sets';

type Queue = Record<number, SessionSetPatch>;

function readQueue(): Queue {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Queue) : {};
  } catch {
    return {};
  }
}

function writeQueue(queue: Queue): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage indisponível (modo privado, cota excedida) — a fila
    // deixa de persistir entre recarregamentos, mas não quebra a UI.
  }
}

export function enqueuePatch(setId: number, patch: SessionSetPatch): void {
  const queue = readQueue();
  queue[setId] = { ...queue[setId], ...patch };
  writeQueue(queue);
}

export function getQueuedCount(): number {
  return Object.keys(readQueue()).length;
}

export async function flushQueue(
  updateFn: (setId: number, patch: SessionSetPatch) => Promise<void>
): Promise<{ succeeded: number; failed: number }> {
  const queue = readQueue();
  const ids = Object.keys(queue).map(Number);
  let succeeded = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      await updateFn(id, queue[id]);
      delete queue[id];
      succeeded++;
    } catch {
      failed++;
    }
  }

  writeQueue(queue);
  return { succeeded, failed };
}
