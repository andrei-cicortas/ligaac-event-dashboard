import { logEvent } from '../logger.js';

export const ORGANIZER_KEY = process.env.ORGANIZER_KEY || 'ligaac-organizer-2026';

export function verifyOrganizerKey(key) {
  return key === ORGANIZER_KEY;
}

// Logs every organizer-gated request (who/what/when, "who" being the caller's
// IP since auth is a single shared key with no per-user identity) so
// create/edit/delete actions on the event, participants and announcements
// are auditable from stdout.
export function requireOrganizer(req, res, next) {
  const key = req.get('x-organizer-key');
  const authorized = verifyOrganizerKey(key);
  logEvent('organizer.action', { method: req.method, path: req.originalUrl, ip: req.ip, authorized });
  if (!authorized) {
    return res.status(401).json({ error: 'Cheie de organizator invalidă sau lipsă.' });
  }
  next();
}
