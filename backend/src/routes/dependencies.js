import { Router } from 'express';
import { store } from '../store/index.js';

const router = Router();

router.get('/', (req, res) => {
  const deps = store.getDependencies();
  const { type, status } = req.query;

  let filtered = deps;
  if (type) filtered = filtered.filter(d => d.type === type);
  if (status) filtered = filtered.filter(d => d.status === status);

  res.json({ count: filtered.length, dependencies: filtered });
});

router.get('/:id', (req, res) => {
  const dep = store.getDependency(req.params.id);
  if (!dep) return res.status(404).json({ error: 'Dependency not found' });
  res.json(dep);
});

router.post('/', (req, res) => {
  const { id, name, type, description, category, baseUrl, endpoint, method, path, behaviour } = req.body;
  if (!id || !name || !baseUrl || !endpoint) {
    return res.status(400).json({ error: 'Missing required fields: id, name, baseUrl, endpoint' });
  }

  const dep = store.addDependency({
    id, name, type: type || 'api', description: description || '', category: category || 'Custom',
    baseUrl, endpoint, method: method || 'GET', path: path || endpoint.split(' ').pop(),
    behaviour: behaviour || { format: 'JSON', auth: 'no authentication', version: 'v1', rateLimit: null, pagination: null }
  });

  if (!dep) return res.status(409).json({ error: 'Dependency already exists', id });
  res.status(201).json(dep);
});

router.patch('/:id', (req, res) => {
  const updated = store.updateDependency(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Dependency not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const removed = store.removeDependency(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Dependency not found' });
  res.json({ deleted: req.params.id });
});

export default router;
