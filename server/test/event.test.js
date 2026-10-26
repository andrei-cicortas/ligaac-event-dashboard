import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, startServer, stopServer, url, organizerHeaders } from './helpers.js';

before(startServer);
after(stopServer);
beforeEach(() => seedStore());

test('GET /api/event returns the current event', async () => {
  const res = await fetch(url('/api/event'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, 'Test Event');
  assert.equal(body.location, 'Test Location');
});

test('PUT /api/event without organizer key is rejected', async () => {
  const res = await fetch(url('/api/event'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x', date: '2026-01-01T00:00:00Z', location: 'L', description: 'D' }),
  });
  assert.equal(res.status, 401);
});

test('PUT /api/event with a wrong organizer key is rejected', async () => {
  const res = await fetch(url('/api/event'), {
    method: 'PUT',
    headers: organizerHeaders({ 'x-organizer-key': 'wrong-key' }),
    body: JSON.stringify({ name: 'x', date: '2026-01-01T00:00:00Z', location: 'L', description: 'D' }),
  });
  assert.equal(res.status, 401);
});

test('PUT /api/event rejects missing required fields with 400', async () => {
  const res = await fetch(url('/api/event'), {
    method: 'PUT',
    headers: organizerHeaders(),
    body: JSON.stringify({ name: 'x', date: '2026-01-01T00:00:00Z', location: 'L' }),
  });
  assert.equal(res.status, 400);
});

test('PUT /api/event rejects an invalid date with 400', async () => {
  const res = await fetch(url('/api/event'), {
    method: 'PUT',
    headers: organizerHeaders(),
    body: JSON.stringify({ name: 'x', date: 'not-a-date', location: 'L', description: 'D' }),
  });
  assert.equal(res.status, 400);
});

test('PUT /api/event with a valid organizer key updates and persists the event', async () => {
  const update = { name: 'Updated Name', date: '2027-01-01T00:00:00Z', location: 'New Loc', description: 'New desc' };
  const putRes = await fetch(url('/api/event'), {
    method: 'PUT',
    headers: organizerHeaders(),
    body: JSON.stringify(update),
  });
  assert.equal(putRes.status, 200);
  assert.deepEqual(await putRes.json(), update);

  const getRes = await fetch(url('/api/event'));
  assert.deepEqual(await getRes.json(), update);
});
