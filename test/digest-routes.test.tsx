import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

type Json = { night: string; rows: { job: string }[]; badLines: number };

// The job cells of the page's table, in page order.
function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1] ?? '');
}

async function both(runsDir: string, night: string) {
  const app = createApp({ ...base, runsDir });
  const page = await app.request(`/digest/${night}`);
  const json = await app.request(`/api/digest/${night}`);
  return { page, json };
}

describe('digest routes on the real fixture', () => {
  it('serves the page and the JSON for 2026-10-28', async () => {
    const { page, json } = await both('runs', '2026-10-28');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('bad lines: 1');
    const body = (await json.json()) as Json;
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(5);
  });

  it('page and JSON list the same jobs in the same order', async () => {
    const { page, json } = await both('runs', '2026-10-28');
    const body = (await json.json()) as Json;
    expect(pageJobs(await page.text())).toEqual(body.rows.map((r) => r.job));
  });
});

describe('digest routes on a temp runs dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('404s on both routes for a night with no file', async () => {
    const { page, json } = await both(dir, '2026-01-01');
    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
    expect(await json.json()).toEqual({ error: 'no digest for that night' });
  });

  it('404s on both routes for a night that is not a date', async () => {
    for (const night of ['..%2Frig', 'notes', '2026-1-1']) {
      const { page, json } = await both(dir, night);
      expect(page.status, `page ${night}`).toBe(404);
      expect(json.status, `json ${night}`).toBe(404);
      // the route's own answer, not a router miss
      expect(await page.text(), `page ${night}`).toContain('no digest for');
      expect(await json.json(), `json ${night}`).toEqual({ error: 'no digest for that night' });
    }
  });

  it('renders the empty night as "nothing ran" and rows: []', async () => {
    writeFileSync(join(dir, '2026-02-02.jsonl'), '');
    const { page, json } = await both(dir, '2026-02-02');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('bad lines');
    expect(await json.json()).toEqual({ night: '2026-02-02', rows: [], badLines: 0 });
  });

  it('shows the bad-line notice and the JSON count agrees, with the good rows still there', async () => {
    writeFileSync(
      join(dir, '2026-03-03.jsonl'),
      [
        '{"at":"2026-03-03T23:00:00+01:00","job":"zeta","status":"ok","owner":null}',
        'not json',
        '{"at":"2026-03-04T00:00:00+01:00","job":"b","status":"maybe","owner":"x"}',
        '{"at":"2026-03-04T01:00:00+01:00","job":"alpha","status":"fail","error":"boom"}',
        '',
      ].join('\n'),
    );
    const { page, json } = await both(dir, '2026-03-03');
    const html = await page.text();
    const body = (await json.json()) as Json;
    expect(body.badLines).toBe(2);
    expect(html).toContain('bad lines: 2');
    expect(html).toContain('could not be read');
    expect(html).not.toContain('nothing ran');
    expect(pageJobs(html)).toEqual(['alpha', 'zeta']);
    expect(pageJobs(html)).toEqual(body.rows.map((r) => r.job));
  });

  it('a file of only bad lines is a night with a notice and nothing ran', async () => {
    writeFileSync(join(dir, '2026-04-04.jsonl'), 'garbage\n{"nope":1}\n');
    const { page, json } = await both(dir, '2026-04-04');
    const html = await page.text();
    expect(html).toContain('bad lines: 2');
    expect(html).toContain('nothing ran');
    expect(await json.json()).toEqual({ night: '2026-04-04', rows: [], badLines: 2 });
  });

  it('page and JSON agree on jobs and order when lines are written out of job order', async () => {
    const line = (at: string, job: string) => `{"at":"${at}","job":"${job}","status":"ok","owner":"rook"}`;
    writeFileSync(
      join(dir, '2026-05-05.jsonl'),
      [
        line('2026-05-05T23:00:00+01:00', 'm/second'),
        line('2026-05-05T23:01:00+01:00', 'z/last'),
        line('2026-05-05T23:02:00+01:00', 'a/first'),
        line('2026-05-05T23:03:00+01:00', 'm/second'),
      ].join('\n'),
    );
    const { page, json } = await both(dir, '2026-05-05');
    const body = (await json.json()) as Json;
    expect(body.rows.map((r) => r.job)).toEqual(['a/first', 'm/second', 'z/last']);
    expect(pageJobs(await page.text())).toEqual(body.rows.map((r) => r.job));
  });
});
