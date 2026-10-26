import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, startServer, stopServer, url, organizerHeaders } from './helpers.js';

before(startServer);
after(stopServer);
beforeEach(() => seedStore());

test('GET /api/participants lists seeded participants, email redacted without an organizer key', async () => {
  const res = await fetch(url('/api/participants'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].email, undefined);
});

test('GET /api/participants reveals email with a valid organizer key', async () => {
  const res = await fetch(url('/api/participants'), { headers: organizerHeaders() });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body[0].email, 'ana.pop@example.com');
});

test('POST /api/participants registers a new participant without auth', async () => {
  const res = await fetch(url('/api/participants'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'New Person', email: 'new.person@example.com', team: 'T', role: 'R' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.name, 'New Person');
  assert.ok(body.id);
  assert.ok(body.registeredAt);

  const list = await (await fetch(url('/api/participants'))).json();
  assert.equal(list.length, 2);
});

test('POST /api/participants rejects a missing name with 400', async () => {
  const res = await fetch(url('/api/participants'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'noname@example.com' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/participants rejects an invalid email with 400', async () => {
  const res = await fetch(url('/api/participants'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad Email', email: 'not-an-email' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/participants rejects a duplicate email (case-insensitive) with 409', async () => {
  const res = await fetch(url('/api/participants'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ana Again', email: 'ANA.POP@EXAMPLE.COM' }),
  });
  assert.equal(res.status, 409);
});

test('PUT /api/participants/:id requires an organizer key', async () => {
  const res = await fetch(url('/api/participants/p1'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Edited', email: 'ana.pop@example.com' }),
  });
  assert.equal(res.status, 401);
});

test('PUT /api/participants/:id updates an existing participant', async () => {
  const res = await fetch(url('/api/participants/p1'), {
    method: 'PUT',
    headers: organizerHeaders(),
    body: JSON.stringify({ name: 'Ana Edited', email: 'ana.pop@example.com', team: 'New Team', role: 'Captain' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, 'Ana Edited');
  assert.equal(body.team, 'New Team');
});

test('PUT /api/participants/:id on an unknown id returns 404', async () => {
  const res = await fetch(url('/api/participants/does-not-exist'), {
    method: 'PUT',
    headers: organizerHeaders(),
    body: JSON.stringify({ name: 'X', email: 'x@example.com' }),
  });
  assert.equal(res.status, 404);
});

test('DELETE /api/participants/:id requires an organizer key', async () => {
  const res = await fetch(url('/api/participants/p1'), { method: 'DELETE' });
  assert.equal(res.status, 401);
});

test('DELETE /api/participants/:id removes the participant', async () => {
  const res = await fetch(url('/api/participants/p1'), {
    method: 'DELETE',
    headers: organizerHeaders(),
  });
  assert.equal(res.status, 204);

  const list = await (await fetch(url('/api/participants'))).json();
  assert.equal(list.length, 0);
});

test('DELETE /api/participants/:id on an unknown id returns 404', async () => {
  const res = await fetch(url('/api/participants/does-not-exist'), {
    method: 'DELETE',
    headers: organizerHeaders(),
  });
  assert.equal(res.status, 404);
});

test('GET /api/participants supports search, sort and pagination', async () => {
  seedStore({
    participants: [
      { id: 'p1', name: 'Ana', email: 'ana@example.com', team: 'A', role: 'Jucător', registeredAt: '2026-10-20T10:00:00Z' },
      { id: 'p2', name: 'Bogdan', email: 'bogdan@example.com', team: 'B', role: 'Voluntar', registeredAt: '2026-10-21T10:00:00Z' },
    ],
  });

  const searchRes = await fetch(url('/api/participants?q=ana'));
  assert.deepEqual((await searchRes.json()).map((p) => p.id), ['p1']);

  const pagedRes = await fetch(url('/api/participants?sortBy=name&sortDir=desc&page=1&pageSize=1'));
  const paged = await pagedRes.json();
  assert.equal(paged.total, 2);
  assert.equal(paged.items[0].id, 'p2');
});

test('GET /api/participants/export requires an organizer key and returns CSV', async () => {
  const unauth = await fetch(url('/api/participants/export'));
  assert.equal(unauth.status, 401);

  const res = await fetch(url('/api/participants/export'), { headers: organizerHeaders() });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const text = await res.text();
  assert.match(text, /Nume,Email,Echipă,Rol,Data înscrierii/);
  assert.match(text, /ana\.pop@example\.com/);
});

test('GET /api/participants/stats requires an organizer key and summarizes counts', async () => {
  const unauth = await fetch(url('/api/participants/stats'));
  assert.equal(unauth.status, 401);

  const res = await fetch(url('/api/participants/stats'), { headers: organizerHeaders() });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 1);
  assert.equal(body.byRole[0].label, 'Jucător');
});
