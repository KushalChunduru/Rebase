import { Router } from 'express';
import {
  getActiveMutations,
  isMutationActive,
  applyMutation,
  revertMutation,
  resetAll,
  getHistory
} from '../state.js';
import { getMutationList, getMutation } from '../mutations.js';

const router = Router();

router.get('/status', (req, res) => {
  const mutations = getMutationList().map(m => ({
    ...m,
    active: isMutationActive(m.id)
  }));

  res.json({
    timestamp: new Date().toISOString(),
    activeMutations: getActiveMutations(),
    mutations
  });
});

router.get('/mutations', (req, res) => {
  const mutations = getMutationList().map(m => ({
    ...m,
    active: isMutationActive(m.id)
  }));
  res.json({ mutations });
});

router.post('/mutate', (req, res) => {
  const { id, action } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing mutation id' });

  const mutation = getMutation(id);
  if (!mutation) return res.status(404).json({ error: 'Unknown mutation', id });

  if (action === 'revert') {
    const result = revertMutation(id);
    return res.json({ mutation: id, action: 'revert', ...result });
  }

  const result = applyMutation(id);
  res.json({ mutation: id, action: 'apply', ...result });
});

router.post('/toggle', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing mutation id' });

  const mutation = getMutation(id);
  if (!mutation) return res.status(404).json({ error: 'Unknown mutation', id });

  if (isMutationActive(id)) {
    const result = revertMutation(id);
    return res.json({ mutation: id, action: 'revert', ...result });
  }

  const result = applyMutation(id);
  res.json({ mutation: id, action: 'apply', ...result });
});

router.post('/reset', (req, res) => {
  const result = resetAll();
  res.json({ action: 'reset', ...result });
});

router.get('/history', (req, res) => {
  res.json({ history: getHistory() });
});

export default router;
