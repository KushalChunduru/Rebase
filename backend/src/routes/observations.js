import { Router } from 'express';
import { store } from '../store/index.js';

const router = Router();

router.get('/', (req, res) => {
  const { dependencyId, limit } = req.query;
  const observations = store.getObservations(dependencyId, parseInt(limit) || 50);
  res.json({ count: observations.length, observations });
});

router.get('/baselines', (req, res) => {
  res.json({ baselines: store.getAllBaselines() });
});

router.get('/baselines/:dependencyId', (req, res) => {
  const baseline = store.getBaseline(req.params.dependencyId);
  if (!baseline) return res.status(404).json({ error: 'No baseline for this dependency' });
  res.json(baseline);
});

export default router;
