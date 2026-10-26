import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createRateLimiter } from '../src/middleware/rateLimit.js';

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.post('/ping', createRateLimiter({ capacity: 2, refillMs: 60_000 }), (req, res) => res.status(200).end());
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('allows requests up to capacity, then responds 429', async () => {
  const first = await fetch(`${baseUrl}/ping`, { method: 'POST' });
  const second = await fetch(`${baseUrl}/ping`, { method: 'POST' });
  const third = await fetch(`${baseUrl}/ping`, { method: 'POST' });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
});
