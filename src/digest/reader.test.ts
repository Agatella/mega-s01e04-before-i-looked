import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from './reader.js';
import type { DigestRow } from './types.js';

// runs/ is read-only (fixtures). Each test gets a fresh temp dir for anything it writes;
// the one test that reads the real fixture uses the repo's runs/ directly.
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'digest-reader-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeNight(night: string, body: string): void {
  writeFileSync(join(tempDir, `${night}.jsonl`), body);
}

describe('readNight on the 2026-10-28 fixture', () => {
  it('returns 5 jobs and counts the 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    if (!night) return;

    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('aggregates fixtures/refresh (3 retries, then ok)', () => {
    const night = readNight('runs', '2026-10-28');
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toEqual<DigestRow>({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('aggregates lane/sync across the whole night', () => {
    const night = readNight('runs', '2026-10-28');
    const row = night?.rows.find((r) => r.job === 'lane/sync');
    expect(row).toEqual<DigestRow>({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('keeps the failing notes/backup with its error', () => {
    const night = readNight('runs', '2026-10-28');
    const row = night?.rows.find((r) => r.job === 'notes/backup');
    expect(row).toEqual<DigestRow>({
      job: 'notes/backup',
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      firstAt: '2026-10-29T04:00:01+01:00',
      lastAt: '2026-10-29T04:00:01+01:00',
    });
  });

  it('keeps digest/render with owner null (never dropped)', () => {
    const night = readNight('runs', '2026-10-28');
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row?.owner).toBeNull();
  });
});

describe('readNight edge cases', () => {
  it('returns null when the night has no file', () => {
    expect(readNight(tempDir, '1999-01-01')).toBeNull();
  });

  it('returns 0 rows and 0 bad lines for an empty file', () => {
    writeNight('2026-10-28', '');
    expect(readNight(tempDir, '2026-10-28')).toEqual({ rows: [], badLines: 0 });
  });

  it('does not count blank lines as bad lines', () => {
    writeNight(
      '2026-10-28',
      '\n{"at":"2026-10-28T23:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n\n\n',
    );
    const night = readNight(tempDir, '2026-10-28');
    expect(night?.badLines).toBe(0);
    expect(night?.rows).toHaveLength(1);
  });

  it('counts every kind of malformed line as a bad line', () => {
    writeNight(
      '2026-10-28',
      [
        'not json at all',
        '{"at":"2026-10-28T23:00:00+01:00","job":"a","status":"ok","owner":"rook"}', // ok
        '{"at":"2026-10-28T23:00:01+01:00","job":"a","status":"maybe","owner":"rook"}', // bad status
        '{"job":"a","status":"ok","owner":"rook"}', // missing at
        '{"at":"2026-10-28T23:00:02+01:00","status":"ok","owner":"rook"}', // missing job
        '{"at":"2026-10-28T23:00:03+01:00","job":"a","status":"ok","owner":5}', // bad owner type
        '[1,2,3]', // JSON but not an object
        '',
      ].join('\n'),
    );
    const night = readNight(tempDir, '2026-10-28');
    expect(night?.badLines).toBe(6);
    expect(night?.rows).toHaveLength(1);
  });

  it('keeps the offset from the log instead of converting to UTC', () => {
    writeNight(
      '2026-10-28',
      '{"at":"2026-10-28T23:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n' +
        '{"at":"2026-10-29T04:00:00-05:00","job":"a","status":"ok","owner":"rook"}\n',
    );
    const row = readNight(tempDir, '2026-10-28')?.rows[0];
    expect(row?.firstAt).toBe('2026-10-28T23:00:00+01:00');
    expect(row?.lastAt).toBe('2026-10-29T04:00:00-05:00');
  });

  it('does not erase an earlier owner with a later null', () => {
    writeNight(
      '2026-10-28',
      '{"at":"2026-10-28T23:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n' +
        '{"at":"2026-10-28T23:00:01+01:00","job":"a","status":"ok","owner":null}\n',
    );
    const row = readNight(tempDir, '2026-10-28')?.rows[0];
    expect(row?.owner).toBe('rook');
  });

  it('picks up an owner that only appears in a later event', () => {
    writeNight(
      '2026-10-28',
      '{"at":"2026-10-28T23:00:00+01:00","job":"a","status":"ok","owner":null}\n' +
        '{"at":"2026-10-28T23:00:01+01:00","job":"a","status":"ok","owner":"rook"}\n',
    );
    const row = readNight(tempDir, '2026-10-28')?.rows[0];
    expect(row?.owner).toBe('rook');
  });
});
