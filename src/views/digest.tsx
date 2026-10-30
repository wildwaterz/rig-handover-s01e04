import type { DigestNight, DigestRow } from '../digest/types.js';

// Retries at or above this are called out; the plan's "3 or more".
export const RETRY_FLAG = 3;

// Times are shown as written in the log, offset included; never converted.
function Row({ row }: { row: DigestRow }) {
  const failed = row.fails > 0; // any fail line, even if the job recovered
  const retried = row.retries >= RETRY_FLAG;
  return (
    <tr class={failed ? 'warn' : undefined}>
      <td>{row.job}</td>
      <td>{row.owner ?? '—'}</td>
      <td>{row.runs}</td>
      <td class={retried ? 'warn' : undefined}>{retried ? `${row.retries} (many retries)` : row.retries}</td>
      <td>{row.lastStatus === 'fail' ? 'FAIL' : failed ? `${row.lastStatus} (${row.fails} fail)` : row.lastStatus}</td>
      <td>{row.lastError ?? '—'}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function Digest({ digest }: { digest: DigestNight }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.badLines > 0 && (
        <p class="warn">
          bad lines: {digest.badLines} in this night's log could not be read and are not shown.
        </p>
      )}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first at</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <Row row={row} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
