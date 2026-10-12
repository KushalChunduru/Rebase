import { Router } from 'express';
import { store } from '../store/index.js';
import { broadcast } from '../ws.js';
import { observeSdk } from '../modules/observer/sdk.js';
import { analyzeRelease, getProjectUsage, clearReleaseCache } from '../modules/release-intel/index.js';

const router = Router();

router.get('/', (_req, res) => {
  const sdks = store.getDependencies().filter(d => d.type === 'sdk');
  res.json({ sdks });
});

router.get('/:id', (req, res) => {
  const dep = store.getDependency(req.params.id);
  if (!dep || dep.type !== 'sdk') return res.status(404).json({ error: 'SDK not found' });
  res.json(dep);
});

router.post('/:id/observe', async (req, res) => {
  const dep = store.getDependency(req.params.id);
  if (!dep || dep.type !== 'sdk') return res.status(404).json({ error: 'SDK not found' });

  const observation = await observeSdk(dep);

  if (observation.success) {
    const data = observation.rawData;

    store.updateDependency(dep.id, {
      currentVersion: data.pinnedVersion,
      latestVersion: data.latestVersion,
      lastCheckedAt: observation.metadata.observedAt,
      lastLatencyMs: observation.metadata.latencyMs,
      deprecated: data.deprecated,
      status: data.majorDrift ? 'change-detected'
            : data.versionDrift ? 'monitoring'
            : 'monitoring'
    });

    store.addObservation({
      dependencyId: dep.id,
      type: 'sdk',
      success: true,
      data: data,
      metadata: observation.metadata
    });

    broadcast({
      type: 'sdk:observed',
      dependencyId: dep.id,
      name: dep.name,
      language: dep.language,
      pinnedVersion: data.pinnedVersion,
      latestVersion: data.latestVersion,
      versionDrift: data.versionDrift,
      majorDrift: data.majorDrift,
      deprecated: data.deprecated,
      methodCount: data.methodCount,
      latencyMs: observation.metadata.latencyMs,
      timestamp: observation.metadata.observedAt
    });
  }

  res.json(observation);
});

router.post('/observe-all', async (_req, res) => {
  const sdks = store.getDependencies().filter(d => d.type === 'sdk');
  const results = [];

  for (const sdk of sdks) {
    const observation = await observeSdk(sdk);

    if (observation.success) {
      const data = observation.rawData;
      store.updateDependency(sdk.id, {
        currentVersion: data.pinnedVersion,
        latestVersion: data.latestVersion,
        lastCheckedAt: observation.metadata.observedAt,
        lastLatencyMs: observation.metadata.latencyMs,
        deprecated: data.deprecated,
        status: data.majorDrift ? 'change-detected' : 'monitoring'
      });

      store.addObservation({
        dependencyId: sdk.id,
        type: 'sdk',
        success: true,
        data: data,
        metadata: observation.metadata
      });

      broadcast({
        type: 'sdk:observed',
        dependencyId: sdk.id,
        name: sdk.name,
        language: sdk.language,
        pinnedVersion: data.pinnedVersion,
        latestVersion: data.latestVersion,
        versionDrift: data.versionDrift,
        majorDrift: data.majorDrift,
        deprecated: data.deprecated,
        methodCount: data.methodCount,
        latencyMs: observation.metadata.latencyMs,
        timestamp: observation.metadata.observedAt
      });
    }

    results.push({
      id: sdk.id,
      name: sdk.name,
      success: observation.success,
      latestVersion: observation.rawData?.latestVersion,
      versionDrift: observation.rawData?.versionDrift,
      majorDrift: observation.rawData?.majorDrift,
      error: observation.error || null
    });
  }

  res.json({ observed: results.length, results });
});

// ─── Release Intelligence endpoints ───

router.get('/:id/release-intel', async (req, res) => {
  const dep = store.getDependency(req.params.id);
  if (!dep || dep.type !== 'sdk') return res.status(404).json({ error: 'SDK not found' });

  try {
    const analysis = await analyzeRelease(dep);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/usage', (req, res) => {
  const dep = store.getDependency(req.params.id);
  if (!dep || dep.type !== 'sdk') return res.status(404).json({ error: 'SDK not found' });

  const usage = getProjectUsage(dep);
  res.json(usage);
});

router.post('/release-intel/clear-cache', (_req, res) => {
  clearReleaseCache();
  res.json({ cleared: true });
});

export default router;
