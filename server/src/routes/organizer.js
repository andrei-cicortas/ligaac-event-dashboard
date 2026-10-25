import { Router } from 'express';
import { verifyOrganizerKey } from '../middleware/organizerAuth.js';

const router = Router();

// Lets the frontend check a key before storing it, without leaking the real
// key or forcing every failed check through a noisy 401 on a data endpoint.
router.post('/verify', (req, res) => {
  res.json({ ok: verifyOrganizerKey(req.body.key) });
});

export default router;
