import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './reader.js';
import type { RunStatus } from './types.js';

// Log lines per status for one night. Bad lines are in none of them.
export type StatusCounts = Record<RunStatus, number>;

export function countLines(text: string): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) counts[line.status] += 1;
  }
  return counts;
}

// null when the night's file can't be read; the board renders that as —.
export function countNight(runsDir: string, night: string): StatusCounts | null {
  try {
    return countLines(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
