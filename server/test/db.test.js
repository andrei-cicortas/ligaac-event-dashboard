import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.LIGAAC_DB_PATH = ':memory:';
const { readStore, writeStore } = await import('../src/db.js');

test('writeStore followed by readStore round-trips event/participants/announcements', () => {
  const store = {
    event: { name: 'E', date: '2026-01-01T00:00:00Z', location: 'L', description: 'D' },
    participants: [
      { id: '1', name: 'A', email: 'a@b.com', team: 'T', role: 'R', registeredAt: '2026-01-01T00:00:00Z' },
      { id: '2', name: 'B', email: 'b@b.com', team: '', role: '', registeredAt: '2026-01-02T00:00:00Z' },
    ],
    announcements: [
      {
        id: 'a1',
        title: 'T1',
        content: 'C1',
        pinned: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
  };

  writeStore(store);
  assert.deepEqual(readStore(), store);
});

test('writeStore fully replaces previous participants/announcements (no leftovers)', () => {
  writeStore({
    event: { name: 'E1', date: '2026-01-01T00:00:00Z', location: 'L', description: 'D' },
    participants: [{ id: 'x', name: 'X', email: 'x@x.com', team: '', role: '', registeredAt: '2026-01-01T00:00:00Z' }],
    announcements: [],
  });

  writeStore({
    event: { name: 'E2', date: '2026-02-01T00:00:00Z', location: 'L2', description: 'D2' },
    participants: [],
    announcements: [{ id: 'y', title: 'Y', content: 'C', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' }],
  });

  const result = readStore();
  assert.equal(result.event.name, 'E2');
  assert.deepEqual(result.participants, []);
  assert.equal(result.announcements.length, 1);
  assert.equal(result.announcements[0].id, 'y');
});
