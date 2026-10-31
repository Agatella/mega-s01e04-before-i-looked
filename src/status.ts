import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { ZERO_COUNTS, countStatuses, type StatusCounts } from './digest/counts.js';
import { readNight } from './digest/reader.js';
import { lastBeat, type Beat } from './heartbeat.js';

// One night as the status board sees it: the ISO date plus the per-row ok/retry/fail counts
// (plan §2c). The board links the date to `/digest/<night>` and shows the counts beside it.
export type NightOnDisk = {
  night: string;
  counts: StatusCounts;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightOnDisk[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights: NightOnDisk[] = nightsOnDisk(config.runsDir).map((night) => {
    const digest = readNight(config.runsDir, night);
    // A listed-but-missing file (reader returned null) renders as 0 · 0 · 0: the board
    // still shows the night, but there is nothing to count (plan §2c).
    return { night, counts: digest === null ? { ...ZERO_COUNTS } : countStatuses(digest) };
  });

  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
  };
}
