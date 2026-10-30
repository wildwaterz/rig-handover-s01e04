import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links each night to its digest with ok / retry / fail counts, oldest first', async () => {
    const html = await (await createApp(config).request('/')).text();
    const a = html.indexOf('<a href="/digest/2026-10-27">2026-10-27</a>');
    const b = html.indexOf('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(html).toContain('7 ok · 0 retry · 0 fail');
    expect(html).toContain('10 ok · 4 retry · 1 fail');
  });

  it('skips bad lines in the counts and files that are not a night', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    try {
      const ok = '{"at":"2026-10-30T01:00:00+01:00","job":"a","status":"ok","owner":null}';
      writeFileSync(join(dir, '2026-10-30.jsonl'), `${ok}\nnot json\n{"status":"fail"}\n`);
      writeFileSync(join(dir, '2026-10-31.jsonl'), '');
      writeFileSync(join(dir, 'notes.jsonl'), ok);
      writeFileSync(join(dir, '2026-10-29.txt'), ok);
      const html = await (await createApp({ ...config, runsDir: dir }).request('/')).text();
      expect(html).toContain('1 ok · 0 retry · 0 fail');
      expect(html).toContain('0 ok · 0 retry · 0 fail');
      expect(html).toContain('/digest/2026-10-31');
      expect(html).not.toContain('/digest/notes');
      expect(html).not.toContain('/digest/2026-10-29');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
