import http from 'node:http';

process.env.LIGAAC_DB_PATH = process.env.LIGAAC_DB_PATH || ':memory:';
process.env.RATE_LIMIT_CAPACITY = process.env.RATE_LIMIT_CAPACITY || '1000';
process.env.ORGANIZER_KEY = process.env.ORGANIZER_KEY || 'test-organizer-key';

const { createApp } = await import('../src/app.js');
const { writeStore } = await import('../src/db.js');

export const ORGANIZER_KEY = process.env.ORGANIZER_KEY;

export function seedStore(overrides = {}) {
  const store = {
    event: {
      name: 'Test Event',
      date: '2026-11-15T18:00:00+02:00',
      location: 'Test Location',
      description: 'Test description',
    },
    participants: [
      {
        id: 'p1',
        name: 'Ana Pop',
        email: 'ana.pop@example.com',
        team: 'Squad',
        role: 'Jucător',
        registeredAt: '2026-10-20T10:00:00+03:00',
      },
    ],
    announcements: [
      {
        id: 'a1',
        title: 'Bun venit',
        content: 'Continut',
        createdAt: '2026-10-18T12:00:00+03:00',
        updatedAt: '2026-10-18T12:00:00+03:00',
      },
    ],
    ...overrides,
  };
  writeStore(store);
  return store;
}

let server;
let baseUrl;

export async function startServer() {
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  return baseUrl;
}

export async function stopServer() {
  await new Promise((resolve) => server.close(resolve));
}

export function url(pathname) {
  return `${baseUrl}${pathname}`;
}

export function organizerHeaders(extra = {}) {
  return { 'x-organizer-key': ORGANIZER_KEY, 'Content-Type': 'application/json', ...extra };
}
