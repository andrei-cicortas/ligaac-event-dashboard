import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'store.db');
const LEGACY_JSON_PATH = path.join(DATA_DIR, 'store.json');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS event (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    team TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    registeredAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

let db;

// Lazy singleton: the connection (and any one-time legacy-data migration) is
// opened on first use, not at import time, so tests can point LIGAAC_DB_PATH
// at ':memory:' (or a temp file) before the first readStore()/writeStore()
// call without needing dynamic imports to dodge ESM's hoisted static imports.
function getDb() {
  if (db) return db;

  const usingDefaultPath = !process.env.LIGAAC_DB_PATH;
  const dbPath = process.env.LIGAAC_DB_PATH || DEFAULT_DB_PATH;

  if (usingDefaultPath) fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);

  if (usingDefaultPath) migrateLegacyJsonIfEmpty(db);

  return db;
}

// One-time import of the old store.json seed data into a freshly created
// SQLite file, so switching persistence backends doesn't lose the event's
// existing seed data on deploy.
function migrateLegacyJsonIfEmpty(database) {
  const { n } = database.prepare('SELECT COUNT(*) AS n FROM event').get();
  if (n > 0) return;
  if (!fs.existsSync(LEGACY_JSON_PATH)) return;
  const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON_PATH, 'utf-8'));
  writeStoreTo(database, legacy);
}

function writeStoreTo(database, store) {
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM event').run();
    database.prepare('DELETE FROM participants').run();
    database.prepare('DELETE FROM announcements').run();

    database
      .prepare('INSERT INTO event (id, name, date, location, description) VALUES (1, ?, ?, ?, ?)')
      .run(store.event.name, store.event.date, store.event.location, store.event.description);

    const insertParticipant = database.prepare(
      'INSERT INTO participants (id, name, email, team, role, registeredAt) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const p of store.participants) {
      insertParticipant.run(p.id, p.name, p.email, p.team || '', p.role || '', p.registeredAt);
    }

    const insertAnnouncement = database.prepare(
      'INSERT INTO announcements (id, title, content, pinned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const a of store.announcements) {
      insertAnnouncement.run(a.id, a.title, a.content, a.pinned ? 1 : 0, a.createdAt, a.updatedAt);
    }

    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

// node:sqlite returns rows as null-prototype objects; normalize to plain
// objects so callers get exactly the same shape the old JSON-backed db.js
// produced (JSON.parse always yields plain objects).
const toPlain = (row) => (row ? { ...row } : row);

export function readStore() {
  const database = getDb();
  const event = toPlain(database.prepare('SELECT name, date, location, description FROM event WHERE id = 1').get());
  const participants = database
    .prepare('SELECT id, name, email, team, role, registeredAt FROM participants ORDER BY rowid')
    .all()
    .map(toPlain);
  const announcements = database
    .prepare('SELECT id, title, content, pinned, createdAt, updatedAt FROM announcements ORDER BY rowid')
    .all()
    .map((row) => ({ ...toPlain(row), pinned: Boolean(row.pinned) }));
  return { event, participants, announcements };
}

export function writeStore(store) {
  writeStoreTo(getDb(), store);
}
