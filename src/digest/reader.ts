import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunEvent, RunStatus } from './types.js';

// Reader for runs/<night>.jsonl. Pure logic: no view, no sort by anything other than job
// (so page and JSON agree by construction, plan §2b). Times are kept as-is: never convert
// the offset (styleguide).

const RUN_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>(['ok', 'retry', 'fail']);

// Parse one JSONL line into a RunEvent, or return null if the line is invalid in any way:
// unparsable JSON, wrong shape, wrong types, unknown status. The caller counts the null.
function parseEvent(line: string): RunEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const raw = parsed as Record<string, unknown>;

  const { at, job, status, owner, error } = raw;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !RUN_STATUSES.has(status as RunStatus)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;

  const event: RunEvent = {
    at,
    job,
    status: status as RunStatus,
    owner: owner as string | null,
  };
  if (typeof error === 'string') event.error = error;
  return event;
}

// Fold one event into the row for its job. First time we see the job, seed the row;
// afterwards, update the running totals and the "last ..." fields.
function fold(row: DigestRow | undefined, event: RunEvent): DigestRow {
  if (!row) {
    return {
      job: event.job,
      owner: event.owner,
      runs: 1,
      retries: event.status === 'retry' ? 1 : 0,
      lastStatus: event.status,
      lastError: event.error ?? null,
      firstAt: event.at,
      lastAt: event.at,
    };
  }
  return {
    job: row.job,
    // Keep the last known owner: if a later event names an owner, that wins; a trailing null
    // doesn't erase an earlier name. The row still exists either way (plan §1).
    owner: event.owner ?? row.owner,
    runs: row.runs + 1,
    retries: row.retries + (event.status === 'retry' ? 1 : 0),
    lastStatus: event.status,
    lastError: event.error ?? null,
    firstAt: row.firstAt,
    lastAt: event.at,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    // No file for this night: the caller renders 404 (plan §2a). Anything else bubbles.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of text.split('\n')) {
    // A blank line (including the trailing newline at EOF) isn't a line of data.
    if (line.trim() === '') continue;
    const event = parseEvent(line);
    if (!event) {
      badLines += 1;
      continue;
    }
    byJob.set(event.job, fold(byJob.get(event.job), event));
  }

  // Alphabetical by job: deterministic for callers, and "sorted by job" (plan §2a) + "same
  // order as the page" (plan §2b) come for free.
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { rows, badLines };
};
