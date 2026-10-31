import { describe, expect, it } from 'vitest';
import { isMarked, toDigestPage } from './page.js';
import type { DigestRow, NightDigest } from './types.js';

// Pins the mark rule for the digest page (plan §2a: retries of 3 or more, and any `fail`).
// The view trusts this, so if the rule drifts the test catches it before the HTML does.

function row(overrides: Partial<DigestRow> = {}): DigestRow {
  return {
    job: 'a',
    owner: 'rook',
    runs: 1,
    retries: 0,
    lastStatus: 'ok',
    lastError: null,
    firstAt: '2026-10-28T23:00:00+01:00',
    lastAt: '2026-10-28T23:00:00+01:00',
    ...overrides,
  };
}

describe('isMarked', () => {
  it('is false for a plain ok row', () => {
    expect(isMarked(row())).toBe(false);
  });

  it('is false for retries below the threshold, even if the last was a retry', () => {
    expect(isMarked(row({ retries: 2, lastStatus: 'retry' }))).toBe(false);
  });

  it('is true at exactly 3 retries', () => {
    expect(isMarked(row({ retries: 3, lastStatus: 'ok' }))).toBe(true);
  });

  it('is true for any fail, no matter the retry count', () => {
    expect(isMarked(row({ retries: 0, lastStatus: 'fail' }))).toBe(true);
  });
});

describe('toDigestPage', () => {
  it('passes night and badLines through and marks each row', () => {
    const digest: NightDigest = {
      rows: [
        row({ job: 'a' }),
        row({ job: 'b', retries: 3, lastStatus: 'ok' }),
        row({ job: 'c', lastStatus: 'fail' }),
      ],
      badLines: 1,
    };
    const page = toDigestPage('2026-10-28', digest);
    expect(page.night).toBe('2026-10-28');
    expect(page.badLines).toBe(1);
    expect(page.rows.map((r) => [r.job, r.marked])).toEqual([
      ['a', false],
      ['b', true],
      ['c', true],
    ]);
  });

  it('keeps the row order the reader produced', () => {
    const digest: NightDigest = {
      rows: [row({ job: 'alpha' }), row({ job: 'beta' }), row({ job: 'gamma' })],
      badLines: 0,
    };
    expect(toDigestPage('2026-10-28', digest).rows.map((r) => r.job)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });
});
