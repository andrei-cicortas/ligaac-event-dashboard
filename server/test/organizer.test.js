import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, startServer, stopServer, url, ORGANIZER_KEY } from './helpers.js';

before(startServer);
after(stopServer);
beforeEach(() => seedStore());

test('POST /api/organizer/verify returns ok:true for the correct key', async () => {
  const res = await fetch(url('/api/organizer/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: ORGANIZER_KEY }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('POST /api/organizer/verify returns ok:false for a wrong key', async () => {
  const res = await fetch(url('/api/organizer/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'wrong' }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: false });
});

test('malformed JSON body returns 400', async () => {
  const res = await fetch(url('/api/organizer/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not valid json',
  });
  assert.equal(res.status, 400);
});
