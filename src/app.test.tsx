import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { RigConfig } from './config.js';
import type { DigestPage } from './digest/page.js';

// Route tests for /digest/:night and /api/digest/:night (plan §2d). Both routes share the
// reader and `toDigestPage`, so the four scenarios (exists, missing, empty, bad line) are
// run against both. runs/ is read-only (AGENTS.md), so every test writes into a fresh temp
// dir and the app is pointed at it through its config — the real runs/ never gets touched.

let runsDir: string;

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function makeConfig(): RigConfig {
  return {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
}

function writeNight(night: string, body: string): void {
  writeFileSync(join(runsDir, `${night}.jsonl`), body);
}

// Two valid events (alphabetical order after folding: lane/sync, notes/backup) plus one
// unparseable line. notes/backup is a `fail`, which must be marked in the JSON — the
// mark rule lives in page.ts and the view trusts it (page.test.ts).
const OK_LINE =
  '{"at":"2026-10-28T23:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}';
const FAIL_LINE =
  '{"at":"2026-10-28T23:30:00+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}';
const BAD_LINE = 'not json at all';

describe('GET /digest/:night', () => {
  it('200 for a night that exists, with the job rows in the HTML', async () => {
    writeNight('2026-10-28', `${OK_LINE}\n${FAIL_LINE}\n`);
    const res = await createApp(makeConfig()).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('lane/sync');
    expect(html).toContain('notes/backup');
    // The `fail` row is marked (plan §2a): assert on substring, not DOM.
    expect(html).toContain('quota exceeded');
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(makeConfig()).request('/digest/1999-01-01');
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('no run log for 1999-01-01');
  });

  it('200 with "nothing ran" for an empty night', async () => {
    writeNight('2026-10-28', '');
    const res = await createApp(makeConfig()).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('nothing ran');
    // The empty-file branch is not the 404 branch (plan §2a).
    expect(html).not.toContain('no run log for');
  });

  it('200 for a night with a bad line, rendering the rows that did parse', async () => {
    writeNight('2026-10-28', `${BAD_LINE}\n${OK_LINE}\n${FAIL_LINE}\n`);
    const res = await createApp(makeConfig()).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('lane/sync');
    expect(html).toContain('notes/backup');
    expect(html).not.toContain('nothing ran');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 for a night that exists, with the expected rows shape', async () => {
    writeNight('2026-10-28', `${OK_LINE}\n${FAIL_LINE}\n`);
    const res = await createApp(makeConfig()).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestPage;
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup']);
    const fail = body.rows.find((r) => r.job === 'notes/backup');
    expect(fail?.lastStatus).toBe('fail');
    expect(fail?.marked).toBe(true);
    expect(fail?.lastError).toBe('quota exceeded');
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(makeConfig()).request('/api/digest/1999-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ night: '1999-01-01', error: 'not_found' });
  });

  it('200 with rows: [] for an empty night', async () => {
    writeNight('2026-10-28', '');
    const res = await createApp(makeConfig()).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestPage;
    expect(body).toEqual({ night: '2026-10-28', rows: [], badLines: 0 });
  });

  it('200 for a night with a bad line: badLines ≥ 1 and the parsed rows are kept', async () => {
    writeNight('2026-10-28', `${BAD_LINE}\n${OK_LINE}\n${FAIL_LINE}\n`);
    const res = await createApp(makeConfig()).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestPage;
    expect(body.badLines).toBeGreaterThanOrEqual(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup']);
  });

  it('HTML and JSON agree on the parsed rows when a line is bad (ADR 0001)', async () => {
    // The two branches share the reader and `toDigestPage`; this test pins that: whatever
    // the JSON lists as rows must also show up in the HTML, so the page and the agents'
    // view never drift. One temp night, two requests.
    writeNight('2026-10-28', `${BAD_LINE}\n${OK_LINE}\n${FAIL_LINE}\n`);
    const app = createApp(makeConfig());
    const [htmlRes, jsonRes] = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/api/digest/2026-10-28'),
    ]);
    expect(htmlRes.status).toBe(200);
    expect(jsonRes.status).toBe(200);
    const html = await htmlRes.text();
    const body = (await jsonRes.json()) as DigestPage;
    for (const row of body.rows) {
      expect(html).toContain(row.job);
    }
  });
});
