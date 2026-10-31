import type { Status } from '../status.js';

// The board links each night on disk to its digest and shows the per-row ok / retry / fail
// counts beside it (plan §2c). Counts come from `countStatuses` in src/digest/counts.ts —
// the view only arranges them (styleguide: numbers that can be computed belong in a module).

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map(({ night, counts }) => (
            <li>
              <a href={`/digest/${night}`}>{night}</a>
              {' · '}
              {counts.ok} · {counts.retry} · {counts.fail}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
