import { Router } from 'express';
import { getBaseline, getActiveMutations } from '../state.js';
import { getMutation } from '../mutations.js';

const router = Router();

function applyActiveMutations(data) {
  let result = data;
  for (const id of getActiveMutations()) {
    const mutation = getMutation(id);
    if (mutation && mutation.target === 'webhookEvents') {
      result = mutation.apply(result);
    }
  }
  return result;
}

router.get('/events', (req, res) => {
  const events = applyActiveMutations(getBaseline('webhookEvents'));
  res.json({
    service: 'stripe-webhooks',
    version: 'v1',
    timestamp: new Date().toISOString(),
    events
  });
});

export default router;
