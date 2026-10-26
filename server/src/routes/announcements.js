import { Router } from 'express';
import crypto from 'node:crypto';
import { readStore, writeStore } from '../db.js';
import { requireOrganizer } from '../middleware/organizerAuth.js';
import { emitUpdate } from '../events.js';

const router = Router();

function validate(body) {
  if (!body.title || !String(body.title).trim()) return 'Titlul este obligatoriu.';
  if (!body.content || !String(body.content).trim()) return 'Conținutul este obligatoriu.';
  return null;
}

router.get('/', (req, res) => {
  const { announcements } = readStore();
  // Pinned announcements always lead, regardless of date; within each group,
  // newest first.
  const sorted = [...announcements].sort((a, b) => {
    const pinnedDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (pinnedDiff !== 0) return pinnedDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  res.json(sorted);
});

router.post('/', requireOrganizer, (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });

  const now = new Date().toISOString();
  const announcement = {
    id: crypto.randomUUID(),
    title: req.body.title.trim(),
    content: req.body.content.trim(),
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  const store = readStore();
  store.announcements.push(announcement);
  writeStore(store);
  emitUpdate('announcements');
  res.status(201).json(announcement);
});

router.put('/:id', requireOrganizer, (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });

  const store = readStore();
  const idx = store.announcements.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Anunțul nu a fost găsit.' });

  store.announcements[idx] = {
    ...store.announcements[idx],
    title: req.body.title.trim(),
    content: req.body.content.trim(),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  emitUpdate('announcements');
  res.json(store.announcements[idx]);
});

router.put('/:id/pin', requireOrganizer, (req, res) => {
  const store = readStore();
  const idx = store.announcements.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Anunțul nu a fost găsit.' });

  store.announcements[idx] = {
    ...store.announcements[idx],
    pinned: Boolean(req.body.pinned),
  };
  writeStore(store);
  emitUpdate('announcements');
  res.json(store.announcements[idx]);
});

router.delete('/:id', requireOrganizer, (req, res) => {
  const store = readStore();
  const idx = store.announcements.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Anunțul nu a fost găsit.' });
  store.announcements.splice(idx, 1);
  writeStore(store);
  emitUpdate('announcements');
  res.status(204).end();
});

export default router;
