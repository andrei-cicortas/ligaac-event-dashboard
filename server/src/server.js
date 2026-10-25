import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import eventRouter from './routes/event.js';
import participantsRouter from './routes/participants.js';
import announcementsRouter from './routes/announcements.js';
import organizerRouter from './routes/organizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/event', eventRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/organizer', organizerRouter);

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corp de request JSON invalid.' });
  }
  next(err);
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`LigaAC event dashboard rulează pe http://localhost:${PORT}`);
});
