import type { DigestRow, NightDigest } from './types.js';

// Shaping between the reader and the view. The reader has no idea which rows get marked;
// the view shouldn't be computing it either (styleguide: pure logic in `src/<feature>/`,
// views in `src/views/`). This module owns that rule.

// Plan §2a: "retries of 3 or more and any `fail` marked". One source of truth so the view
// (and later §2b's JSON) can agree by construction.
export function isMarked(row: DigestRow): boolean {
  return row.lastStatus === 'fail' || row.retries >= 3;
}

export type DigestPageRow = DigestRow & { marked: boolean };

export type DigestPage = {
  night: string;
  rows: DigestPageRow[];
  badLines: number;
};

// Pure function: reader output + night string -> view input. Row order is kept as the reader
// produced it (alphabetical by job, plan §2a + §2b).
export function toDigestPage(night: string, digest: NightDigest): DigestPage {
  return {
    night,
    rows: digest.rows.map((row) => ({ ...row, marked: isMarked(row) })),
    badLines: digest.badLines,
  };
}
