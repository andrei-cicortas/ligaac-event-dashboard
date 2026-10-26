import { Router } from 'express';
import crypto from 'node:crypto';
import { readStore, writeStore } from '../db.js';
import { requireOrganizer, verifyOrganizerKey } from '../middleware/organizerAuth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body) {
  const { name, email } = body;
  if (!name || !String(name).trim()) return 'Numele este obligatoriu.';
  if (!email || !EMAIL_RE.test(email)) return 'Emailul nu este valid.';
  return null;
}

// Public callers never get participant emails — only a request carrying a
// valid organizer key does. This is enforced here (not just hidden in the
// UI) so the raw API response can't be used to scrape emails.
function redact(p, includeEmail) {
  if (includeEmail) return p;
  const { email, ...rest } = p;
  return rest;
}

router.get('/', (req, res) => {
  const { participants } = readStore();
  const isOrganizer = verifyOrganizerKey(req.get('x-organizer-key'));
  res.json(participants.map((p) => redact(p, isOrganizer)));
});

router.post('/', (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });

  const { name, email, team, role } = req.body;
  const store = readStore();
  if (store.participants.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Acest email este deja înregistrat.' });
  }
  const participant = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim(),
    team: (team || '').trim(),
    role: (role || '').trim(),
    registeredAt: new Date().toISOString(),
  };
  store.participants.push(participant);
  writeStore(store);
  res.status(201).json(participant);
});

router.put('/:id', requireOrganizer, (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });

  const store = readStore();
  const idx = store.participants.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Participantul nu a fost găsit.' });

  const { name, email, team, role } = req.body;
  store.participants[idx] = {
    ...store.participants[idx],
    name: name.trim(),
    email: email.trim(),
    team: (team || '').trim(),
    role: (role || '').trim(),
  };
  writeStore(store);
  res.json(store.participants[idx]);
});

router.delete('/:id', requireOrganizer, (req, res) => {
  const store = readStore();
  const idx = store.participants.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Participantul nu a fost găsit.' });
  store.participants.splice(idx, 1);
  writeStore(store);
  res.status(204).end();
});

export default router;
