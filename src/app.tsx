import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { toDigestPage } from './digest/page.js';
import { readNight } from './digest/reader.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Digest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const digest = readNight(config.runsDir, night);
    if (digest === null) {
      // Plan §2a: a night with no file returns 404. The page still carries the lane
      // banner so a screenshot of the error page tells you which lane missed it.
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <h1>digest · {night}</h1>
          <p class="mute">no run log for {night}</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <Digest page={toDigestPage(night, digest)} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    // Plan §2b + ADR 0001: the page and the JSON must never disagree. Both branches run the
    // same reader and the same `toDigestPage` (which fixes order and marks), so the only
    // difference between `/digest/:night` and this route is the serializer.
    const night = c.req.param('night');
    const digest = readNight(config.runsDir, night);
    if (digest === null) {
      // No HTML in the JSON branch: agents parse this. 404 matches the page's 404.
      return c.json({ night, error: 'not_found' }, 404);
    }
    return c.json(toDigestPage(night, digest));
  });

  return app;
}
