import type { DigestPage } from '../digest/page.js';

// Server-rendered JSX (ADR 0001). No client JS, no reformatting of times (styleguide:
// keep the offset from the log), no empty cells (styleguide: missing data is `—`).

const DASH = '—';

export function Digest({ page }: { page: DigestPage }) {
  return (
    <>
      <h1>digest · {page.night}</h1>
      {page.rows.length === 0 ? (
        // Empty file (plan §2a). Reader returned 0 rows; night still has a file, so no 404.
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
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              // `warn` cascades to the cells (see layout.tsx css). Marked = retries >= 3
              // or lastStatus = fail; the rule lives in digest/page.ts.
              <tr class={row.marked ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? DASH}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? DASH}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
