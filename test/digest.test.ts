import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseLine, readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  if (night === null) throw new Error('fixture missing');

  it('has 5 jobs, sorted, and 1 bad line', () => {
    expect(night.night).toBe('2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, keeps the last status and the last error', () => {
    const refresh = night.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const sync = night.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    const backup = night.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps the offset from the log', () => {
    const rotate = night.rows.find((r) => r.job === 'rig/rotate-logs');
    expect(rotate?.firstAt).toBe('2026-10-28T23:00:02+01:00');
    expect(rotate?.lastAt).toBe('2026-10-28T23:00:02+01:00');
  });

  it('keeps a row whose owner is null', () => {
    const render = night.rows.find((r) => r.job === 'digest/render');
    expect(render).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('is null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('is null for a night that is not a date', () => {
    expect(readNight(dir, '../rig')).toBeNull();
    expect(readNight(dir, '')).toBeNull();
  });

  it('is an empty night for an empty file, not null', () => {
    writeFileSync(join(dir, '2026-02-02.jsonl'), '');
    expect(readNight(dir, '2026-02-02')).toEqual({ night: '2026-02-02', rows: [], badLines: 0 });
  });

  it('counts bad lines, skips blank ones, keeps null and missing owners', () => {
    writeFileSync(
      join(dir, '2026-03-03.jsonl'),
      [
        '{"at":"2026-03-03T23:00:00+01:00","job":"a","status":"ok","owner":null}',
        '',
        'not json',
        '{"at":"2026-03-04T00:00:00+01:00","job":"b","status":"maybe","owner":"x"}',
        '{"at":"2026-03-04T01:00:00+01:00","job":"b","status":"fail","error":"boom"}',
        '{"at":"2026-03-04T02:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
        '',
      ].join('\n'),
    );
    const night = readNight(dir, '2026-03-03');
    expect(night?.badLines).toBe(2);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: 'rook',
        runs: 2,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-03-03T23:00:00+01:00',
        lastAt: '2026-03-04T02:00:00+01:00',
      },
      {
        job: 'b',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'boom',
        firstAt: '2026-03-04T01:00:00+01:00',
        lastAt: '2026-03-04T01:00:00+01:00',
      },
    ]);
  });
});

describe('parseLine', () => {
  it('rejects anything that is not a run line', () => {
    expect(parseLine('[]')).toBeNull();
    expect(parseLine('null')).toBeNull();
    expect(parseLine('{"job":"a","status":"ok"}')).toBeNull();
    expect(parseLine('{"at":"t","job":"a","status":"ok","owner":3}')).toBeNull();
    expect(parseLine('{"at":"t","job":"a","status":"ok","error":3}')).toBeNull();
  });
});
