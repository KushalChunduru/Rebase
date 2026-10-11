import { Router } from 'express';
import { store } from '../store/index.js';
import { broadcast } from '../ws.js';
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

  if (dep.type === 'mcp' && run.stageResults?.detect?.changed) {
    const safety = run.stageResults?.safety;
    const semantic = run.stageResults?.semantic;
    broadcast({
      type: 'mcp:drift-detected',
      dependencyId: req.params.dependencyId,
      dependencyName: dep.name,
      risk: semantic?.risk || 'UNKNOWN',
      semanticCompat: semantic?.semanticCompat,
      schemaCompat: semantic?.schemaCompat,
      classification: semantic?.classification,
      decision: safety?.decision || 'unknown',
      reason: safety?.reason,
      diffCount: run.stageResults.detect.diffCount,
      runId: run.id,
      timestamp: new Date().toISOString()
    });
  }

  if (dep.type === 'webhook' && run.stageResults?.detect?.changed) {
    const safety = run.stageResults?.safety;
    store.setWebhookDriftAlert({
      dependencyId: req.params.dependencyId,
      dependencyName: dep.name,
      driftCount: run.stageResults.detect.diffCount,
      decision: safety?.decision || 'unknown',
      risk: run.stageResults?.semantic?.risk || 'UNKNOWN',
      runId: run.id
    });
    console.log(`[PIPELINE] Webhook drift alert ACTIVATED for ${dep.name}`);
  } else if (dep.type === 'webhook' && run.stageResults?.detect && !run.stageResults.detect.changed) {
    if (store.getWebhookDriftAlert()?.dependencyId === req.params.dependencyId) {
      store.clearWebhookDriftAlert();
      console.log(`[PIPELINE] Webhook drift alert CLEARED for ${dep.name}`);
    }
  }

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

router.post('/mcp/execute', (req, res) => {
  const { toolName, params, dependencyId } = req.body;
  if (!toolName || !dependencyId) {
    return res.status(400).json({ error: 'Missing toolName or dependencyId' });
  }

  const dep = store.getDependency(dependencyId);
  if (!dep) return res.status(404).json({ error: 'Dependency not found' });

  const runs = store.getPipelineRuns(50)
    .filter(r => r.dependencyId === dependencyId)
    .reverse();
  const latestRun = runs[0];

  const detect = latestRun?.stageResults?.detect;
  const safety = latestRun?.stageResults?.safety;
  const semantic = latestRun?.stageResults?.semantic;

  const hasActiveDrift = detect?.changed === true;

  if (hasActiveDrift && (safety?.decision === 'blocked' || semantic?.risk === 'CRITICAL')) {
    const result = {
      executed: false,
      blocked: true,
      reason: safety?.reason || 'CRITICAL semantic risk — tool execution blocked',
      toolName,
      params,
      risk: semantic?.risk || 'CRITICAL',
      semanticCompat: semantic?.semanticCompat,
      safetyDecision: safety?.decision || 'blocked',
      pipelineRunId: latestRun?.id,
      timestamp: new Date().toISOString()
    };

    broadcast({
      type: 'mcp:execution-blocked',
      ...result
    });

    return res.status(403).json(result);
  }

  const result = {
    executed: true,
    blocked: false,
    toolName,
    params,
    result: { success: true, message: `Tool ${toolName} executed safely (mock)` },
    safetyDecision: safety?.decision || 'no-drift',
    timestamp: new Date().toISOString()
  };

  broadcast({ type: 'mcp:execution-allowed', ...result });
  res.json(result);
});

export default router;
