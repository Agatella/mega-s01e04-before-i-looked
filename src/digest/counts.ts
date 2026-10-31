import type { NightDigest } from './types.js';

// Per-row `lastStatus` counts for one night — one bucket per job, matching how the digest
// page presents its rows (plan §2c). Pure logic (styleguide: numbers that can be computed
// belong in a module, not typed into a template), so the status board and anyone else can
// agree on what "ok / retry / fail" means for a night.

export type StatusCounts = { ok: number; retry: number; fail: number };

export function countStatuses(digest: NightDigest): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of digest.rows) {
    counts[row.lastStatus] += 1;
  }
  return counts;
}

// Zero counts for a listed-but-missing file (reader returned null): the night is on disk
// so the board still lists it, but there is nothing to count (plan §2c).
export const ZERO_COUNTS: StatusCounts = { ok: 0, retry: 0, fail: 0 };
