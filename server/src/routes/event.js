import { Router } from 'express';
import { readStore, writeStore } from '../db.js';
import { requireOrganizer } from '../middleware/organizerAuth.js';

const router = Router();

router.get('/', (req, res) => {
  const { event } = readStore();
  res.json(event);
});

router.put('/', requireOrganizer, (req, res) => {
  const { name, date, location, description } = req.body;
  if (!name || !date || !location || !description) {
    return res.status(400).json({ error: 'name, date, location și description sunt obligatorii.' });
  }
  if (Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'date trebuie să fie o dată validă (ISO 8601).' });
  }
  const store = readStore();
  store.event = { name, date, location, description };
  writeStore(store);
  res.json(store.event);
});

export default router;
