// Types for the morning digest (plan.md §1).
//
// Section 2 of the plan (page, JSON, board link, route tests) only needs the shapes defined
// here. Keep this file pure types: no runtime, no I/O, no parsing.

// One JSONL event in runs/<night>.jsonl. Parsed at the edge (reader.ts); every other file
// trusts the type (styleguide).
export type RunStatus = 'ok' | 'retry' | 'fail';

export type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job on the digest page. `owner` can be null and the view renders it as `—`
// (ADR 0001 + styleguide). Times keep the offset from the log (styleguide: never UTC).
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// Result of reading one night: the aggregated rows plus the per-night bad-line counter.
// A line that doesn't parse is counted, never thrown — the night still renders (plan §1).
export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
};

// Signature of `readNight` in reader.ts. Returns null when there is no file for the night,
// so a route can 404 cleanly (plan §2a) without catching ENOENT itself.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
