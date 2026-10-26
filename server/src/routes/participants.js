import { Router } from 'express';
import crypto from 'node:crypto';
import { readStore, writeStore } from '../db.js';
import { requireOrganizer, verifyOrganizerKey } from '../middleware/organizerAuth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { emitUpdate } from '../events.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public registration endpoint: protect it from being spammed. Capacity is
// configurable via env vars so tests can run many registrations without
// tripping the limiter while production stays protected.
const registrationRateLimit = createRateLimiter({
  capacity: Number(process.env.RATE_LIMIT_CAPACITY) || 5,
  refillMs: Number(process.env.RATE_LIMIT_REFILL_MS) || 10_000,
  message: 'Prea multe înregistrări de pe această adresă. Încearcă din nou în câteva momente.',
});

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

const SORT_FIELDS = ['name', 'team', 'role', 'registeredAt'];

// Shared by GET / (paginated view) and GET /export (full CSV) so both honor
// the same search/filter/sort query params.
function filterAndSort(participants, { q, team, role, sortBy, sortDir } = {}) {
  let result = participants;

  const needle = q ? String(q).trim().toLowerCase() : '';
  if (needle) {
    result = result.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle)
    );
  }
  if (team) {
    result = result.filter((p) => (p.team || '').toLowerCase() === String(team).toLowerCase());
  }
  if (role) {
    result = result.filter((p) => (p.role || '').toLowerCase() === String(role).toLowerCase());
  }

  const sortField = SORT_FIELDS.includes(sortBy) ? sortBy : null;
  if (sortField) {
    const dir = sortDir === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => {
      if (sortField === 'registeredAt') {
        return (new Date(a.registeredAt) - new Date(b.registeredAt)) * dir;
      }
      const av = (a[sortField] || '').toString().toLowerCase();
      const bv = (b[sortField] || '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }

  return result;
}

router.get('/', (req, res) => {
  const { participants } = readStore();
  const isOrganizer = verifyOrganizerKey(req.get('x-organizer-key'));
  const { q, team, role, sortBy, sortDir, page, pageSize } = req.query;

  const filtered = filterAndSort(participants, { q, team, role, sortBy, sortDir });

  const pageNum = Number.parseInt(page, 10);
  const pageSizeNum = Number.parseInt(pageSize, 10);
  const isPaginated = Number.isInteger(pageNum) && Number.isInteger(pageSizeNum) && pageNum > 0 && pageSizeNum > 0;

  // No page/pageSize: respond exactly as before (plain array), so callers
  // that don't opt into the new params see no behavior change.
  if (!isPaginated) {
    return res.json(filtered.map((p) => redact(p, isOrganizer)));
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSizeNum));
  const safePage = Math.min(pageNum, totalPages);
  const start = (safePage - 1) * pageSizeNum;
  const items = filtered.slice(start, start + pageSizeNum).map((p) => redact(p, isOrganizer));
  res.json({ items, total, page: safePage, pageSize: pageSizeNum, totalPages });
});

function toCsvValue(value) {
  const str = String(value ?? '');
  if (/["\n,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get('/export', requireOrganizer, (req, res) => {
  const { participants } = readStore();
  const { q, team, role, sortBy, sortDir } = req.query;
  const filtered = filterAndSort(participants, { q, team, role, sortBy, sortDir });

  const header = ['Nume', 'Email', 'Echipă', 'Rol', 'Data înscrierii'];
  const rows = filtered.map((p) => [p.name, p.email, p.team || '', p.role || '', p.registeredAt]);
  const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="participanti.csv"');
  // Leading BOM so Excel detects UTF-8 and renders diacritics correctly.
  res.send(`﻿${csv}`);
});

router.get('/stats', requireOrganizer, (req, res) => {
  const { participants } = readStore();

  const byDayMap = new Map();
  const byRoleMap = new Map();
  const byTeamMap = new Map();

  for (const p of participants) {
    const day = (p.registeredAt || '').slice(0, 10) || 'Necunoscut';
    byDayMap.set(day, (byDayMap.get(day) || 0) + 1);

    const role = p.role && p.role.trim() ? p.role.trim() : 'Nespecificat';
    byRoleMap.set(role, (byRoleMap.get(role) || 0) + 1);

    const team = p.team && p.team.trim() ? p.team.trim() : 'Fără echipă';
    byTeamMap.set(team, (byTeamMap.get(team) || 0) + 1);
  }

  const byDay = [...byDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
  const byRole = [...byRoleMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  const byTeam = [...byTeamMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));

  res.json({ total: participants.length, byDay, byRole, byTeam });
});

router.post('/', registrationRateLimit, (req, res) => {
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
  emitUpdate('participants');
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
  emitUpdate('participants');
  res.json(store.participants[idx]);
});

router.delete('/:id', requireOrganizer, (req, res) => {
  const store = readStore();
  const idx = store.participants.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Participantul nu a fost găsit.' });
  store.participants.splice(idx, 1);
  writeStore(store);
  emitUpdate('participants');
  res.status(204).end();
});

export default router;
