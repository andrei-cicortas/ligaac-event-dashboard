import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import eventRouter from './routes/event.js';
import participantsRouter from './routes/participants.js';
import announcementsRouter from './routes/announcements.js';
import organizerRouter from './routes/organizer.js';
import { bus } from './events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use('/api/event', eventRouter);
  app.use('/api/participants', participantsRouter);
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/organizer', organizerRouter);

  // Live updates: browser tabs subscribe via EventSource and refetch whichever
  // resource changed, instead of polling. A heartbeat comment every 25s keeps
  // the connection alive through proxies that time out idle streams.
  app.get('/api/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');

    const onUpdate = (type) => {
      res.write(`event: update\ndata: ${JSON.stringify({ type })}\n\n`);
    };
    bus.on('update', onUpdate);

    const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      bus.off('update', onUpdate);
    });
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Corp de request JSON invalid.' });
    }
    next(err);
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}
