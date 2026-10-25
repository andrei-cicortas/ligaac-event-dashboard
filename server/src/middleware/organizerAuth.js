export const ORGANIZER_KEY = process.env.ORGANIZER_KEY || 'ligaac-organizer-2026';

export function verifyOrganizerKey(key) {
  return key === ORGANIZER_KEY;
}

export function requireOrganizer(req, res, next) {
  const key = req.get('x-organizer-key');
  if (!verifyOrganizerKey(key)) {
    return res.status(401).json({ error: 'Cheie de organizator invalidă sau lipsă.' });
  }
  next();
}
