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

  return app;
}
