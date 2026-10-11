import { Router } from 'express';
import { store } from '../store/index.js';
import { runPipeline, getPipelineStages } from '../modules/pipeline.js';

const router = Router();

function sanitizeRun(run) {
  if (!run?.stageResults) return run;
  const clean = { ...run, stageResults: {} };
  for (const [stage, result] of Object.entries(run.stageResults)) {
    const { _raw, _normalized, _baseline, _diffs, _impacts, _semantic, _adapter, _sandbox, ...publicFields } = result;
    clean.stageResults[stage] = publicFields;
  }
  return clean;
}

router.post('/run/:dependencyId', async (req, res) => {
  const dep = store.getDependency(req.params.dependencyId);
  if (!dep) return res.status(404).json({ error: 'Dependency not found' });

  const run = await runPipeline(req.params.dependencyId);
  res.json(sanitizeRun(run));
});

router.get('/runs', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({ runs: store.getPipelineRuns(limit).map(sanitizeRun) });
});

router.get('/runs/:id', (req, res) => {
  const run = store.getPipelineRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Pipeline run not found' });
  res.json(sanitizeRun(run));
});

router.get('/stages', (req, res) => {
  res.json({ stages: getPipelineStages() });
});

export default router;
