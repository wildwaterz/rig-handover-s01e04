// Plan morning-digest § 1. Types first, so the page, the JSON and the board link can start
// against them before the reader lands.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing. `at` is kept as written (offset included).
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job, in the order the lines were written.
export type DigestRow = {
  job: string;
  owner: string | null; // null stays null here; the view renders it as —
  runs: number; // lines for this job, every status
  retries: number; // lines with status `retry`
  fails: number; // lines with status `fail`, even when a later line recovered
  lastStatus: RunStatus; // status of the job's last line
  lastError: string | null; // most recent `error` on any of the job's lines, else null
  firstAt: string; // `at` of the first line, as written in the log
  lastAt: string; // `at` of the last line, as written in the log
};

// A night that has a file on disk. An empty file is a night with no rows and no bad lines.
export type DigestNight = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse; counted, never thrown
};

// readNight(runsDir, night) reads runs/<night>.jsonl.
// Returns null when there is no file for that night (a route answers 404), and a DigestNight
// otherwise, including for an empty file (rows: []).
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
