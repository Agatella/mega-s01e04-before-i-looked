import { describe, expect, it } from 'vitest';
import { countStatuses } from './counts.js';
import type { DigestRow, NightDigest } from './types.js';

// Pins the per-row counting rule for the status board (plan §2c). One bucket per job,
// keyed on lastStatus; badLines is a reader concern and doesn't move the counts.

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

describe('countStatuses', () => {
  it('is all zeros for a digest with no rows', () => {
    expect(countStatuses({ rows: [], badLines: 0 })).toEqual({ ok: 0, retry: 0, fail: 0 });
  });

  it('counts one bucket per job by lastStatus', () => {
    const digest: NightDigest = {
      rows: [
        row({ job: 'a', lastStatus: 'ok' }),
        row({ job: 'b', lastStatus: 'ok' }),
        row({ job: 'c', lastStatus: 'retry' }),
        row({ job: 'd', lastStatus: 'fail' }),
      ],
      badLines: 0,
    };
    expect(countStatuses(digest)).toEqual({ ok: 2, retry: 1, fail: 1 });
  });

  it('ignores badLines: those are a reader concern, not a per-row status', () => {
    const digest: NightDigest = { rows: [row({ lastStatus: 'fail' })], badLines: 99 };
    expect(countStatuses(digest)).toEqual({ ok: 0, retry: 0, fail: 1 });
  });

  it('matches the 2026-10-28 fixture: 4 ok, 0 retry, 1 fail', () => {
    // The fixture has 5 jobs (reader.test.ts pins the names). notes/backup ends in `fail`;
    // the other four end in `ok`. If the fixture ever changes, both tests move together.
    const digest: NightDigest = {
      rows: [
        row({ job: 'digest/render', lastStatus: 'ok' }),
        row({ job: 'fixtures/refresh', lastStatus: 'ok' }),
        row({ job: 'lane/sync', lastStatus: 'ok' }),
        row({ job: 'notes/backup', lastStatus: 'fail' }),
        row({ job: 'rig/rotate-logs', lastStatus: 'ok' }),
      ],
      badLines: 1,
    };
    expect(countStatuses(digest)).toEqual({ ok: 4, retry: 0, fail: 1 });
  });
});
