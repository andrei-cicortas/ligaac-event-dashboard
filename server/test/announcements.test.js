import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, startServer, stopServer, url, organizerHeaders } from './helpers.js';

before(startServer);
after(stopServer);
beforeEach(() => seedStore());

test('GET /api/announcements lists announcements newest-first', async () => {
  seedStore({
    announcements: [
      { id: 'old', title: 'Old', content: 'c', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'new', title: 'New', content: 'c', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z' },
    ],
  });
  const res = await fetch(url('/api/announcements'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.map((a) => a.id), ['new', 'old']);
});

test('POST /api/announcements requires an organizer key', async () => {
  const res = await fetch(url('/api/announcements'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'T', content: 'C' }),
  });
  assert.equal(res.status, 401);
});

test('POST /api/announcements rejects a missing title with 400', async () => {
  const res = await fetch(url('/api/announcements'), {
    method: 'POST',
    headers: organizerHeaders(),
    body: JSON.stringify({ content: 'C' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/announcements creates a new announcement', async () => {
  const res = await fetch(url('/api/announcements'), {
    method: 'POST',
    headers: organizerHeaders(),
    body: JSON.stringify({ title: 'New title', content: 'New content' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.title, 'New title');
  assert.ok(body.id);
  assert.equal(body.createdAt, body.updatedAt);
});

test('PUT /api/announcements/:id updates title/content and bumps updatedAt', async () => {
  const res = await fetch(url('/api/announcements/a1'), {
    method: 'PUT',
    headers: organizerHeaders(),
    body: JSON.stringify({ title: 'Edited', content: 'Edited content' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.title, 'Edited');
  assert.equal(body.createdAt, '2026-10-18T12:00:00+03:00');
  assert.notEqual(body.updatedAt, body.createdAt);
});

test('PUT /api/announcements/:id on an unknown id returns 404', async () => {
  const res = await fetch(url('/api/announcements/does-not-exist'), {
    method: 'PUT',
    headers: organizerHeaders(),
    body: JSON.stringify({ title: 'T', content: 'C' }),
  });
  assert.equal(res.status, 404);
});

test('DELETE /api/announcements/:id removes the announcement', async () => {
  const res = await fetch(url('/api/announcements/a1'), {
    method: 'DELETE',
    headers: organizerHeaders(),
  });
  assert.equal(res.status, 204);
  const list = await (await fetch(url('/api/announcements'))).json();
  assert.equal(list.length, 0);
});

test('DELETE /api/announcements/:id on an unknown id returns 404', async () => {
  const res = await fetch(url('/api/announcements/does-not-exist'), {
    method: 'DELETE',
    headers: organizerHeaders(),
  });
  assert.equal(res.status, 404);
});

test('PUT /api/announcements/:id/pin pins an announcement and sorts it first', async () => {
  seedStore({
    announcements: [
      { id: 'old', title: 'Old', content: 'c', pinned: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'new', title: 'New', content: 'c', pinned: false, createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z' },
    ],
  });

  const pinRes = await fetch(url('/api/announcements/old/pin'), {
    method: 'PUT',
    headers: organizerHeaders(),
    body: JSON.stringify({ pinned: true }),
  });
  assert.equal(pinRes.status, 200);
  assert.equal((await pinRes.json()).pinned, true);

  const list = await (await fetch(url('/api/announcements'))).json();
  assert.deepEqual(list.map((a) => a.id), ['old', 'new']);
});

test('PUT /api/announcements/:id/pin requires an organizer key', async () => {
  const res = await fetch(url('/api/announcements/a1/pin'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned: true }),
  });
  assert.equal(res.status, 401);
});
