import { store } from '../store/index.js';
import { config } from '../config.js';
import { observe } from './observer/index.js';
import { normalize } from './normalizer/index.js';
import { captureBaseline, getBaseline, hasBaseline } from './baseline/index.js';
import { detectChanges } from './detector/index.js';
import { analyzeImpact } from './analyzer/index.js';
import { analyzeSemantics } from './semantic/index.js';
import { generateAdapter } from './adapter/index.js';
import { validateAdapter } from './sandbox/index.js';
import { evaluateSafety } from './safety/index.js';

const STAGES = ['observe', 'normalize', 'baseline', 'detect', 'analyze', 'semantic', 'adapt', 'sandbox', 'safety'];

export async function runPipeline(dependencyId) {
  const dependency = store.getDependency(dependencyId);
  if (!dependency) throw new Error(`Dependency not found: ${dependencyId}`);

  const run = store.addPipelineRun({
    dependencyId,
    dependencyName: dependency.name,
    status: 'running',
    currentStage: STAGES[0],
    stageResults: {},
    completedStages: []
  });

  try {
    for (const stage of STAGES) {
      run.currentStage = stage;
      const result = await executeStage(stage, dependency, run);
      run.stageResults[stage] = result;
      run.completedStages.push(stage);

      if (result.halt) {
        run.status = result.haltReason || 'halted';
        run.completedAt = new Date().toISOString();
        store.updatePipelineRun(run.id, run);
        return run;
      }
    }

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    store.updatePipelineRun(run.id, run);
    return run;
  } catch (err) {
    run.status = 'error';
    run.error = err.message;
    run.completedAt = new Date().toISOString();
    store.updatePipelineRun(run.id, run);
    return run;
  }
}

async function executeStage(stage, dependency, run) {
  const stageHandlers = {
    async observe() {
      const rawObs = await observe(dependency);
      if (!rawObs.success) {
        return { status: 'error', error: rawObs.error, halt: true, haltReason: 'observe-failed' };
      }
      store.updateDependency(dependency.id, {
        lastObservedAt: rawObs.metadata.observedAt,
        lastLatencyMs: rawObs.metadata.latencyMs,
        lastStatusCode: rawObs.metadata.statusCode
      });
      return { status: 'ok', latencyMs: rawObs.metadata.latencyMs, dataUrl: rawObs.metadata.dataUrl, _raw: rawObs };
    },

    async normalize() {
      const rawObs = run.stageResults.observe._raw;
      const normalized = normalize(rawObs);
      if (!normalized.success) {
        return { status: 'error', error: normalized.error, halt: true, haltReason: 'normalize-failed' };
      }
      const obs = store.addObservation(normalized);
      return { status: 'ok', observationId: obs.id, fields: Object.keys(normalized.data?.[0] || normalized.data || {}), _normalized: normalized };
    },

    async baseline() {
      const normalized = run.stageResults.normalize._normalized;
      const existing = getBaseline(dependency.id);
      if (!existing) {
        const snapshot = captureBaseline(normalized);
        return { status: 'ok', action: 'captured', message: 'First observation — baseline captured', capturedAt: snapshot.capturedAt };
      }
      return { status: 'ok', action: 'retrieved', capturedAt: existing.capturedAt, _baseline: existing };
    },

    async detect() {
      const baselineResult = run.stageResults.baseline;
      if (baselineResult.action === 'captured') {
        return { status: 'ok', changed: false, message: 'First run — no previous baseline to compare', halt: true, haltReason: 'no-previous-baseline' };
      }
      const normalized = run.stageResults.normalize._normalized;
      const baseline = baselineResult._baseline;
      const result = detectChanges(baseline, normalized);
      if (!result.changed) {
        return { status: 'ok', changed: false, summary: result.summary, halt: true, haltReason: 'no-changes' };
      }
      store.updateDependency(dependency.id, { status: 'change-detected' });
      return { status: 'ok', changed: true, diffCount: result.diffs.length, summary: result.summary, _diffs: result.diffs };
    },
    async analyze() {
      const diffs = run.stageResults.detect._diffs;
      const result = analyzeImpact(diffs, dependency);
      return {
        status: 'ok',
        totalAffected: result.totalAffected,
        highestRisk: result.highestRisk,
        summary: result.summary,
        impacts: result.impacts,
        _impacts: result
      };
    },
    async semantic() {
      const diffs = run.stageResults.detect._diffs;
      const impactResult = run.stageResults.analyze._impacts;
      const baseline = run.stageResults.baseline._baseline;
      const normalized = run.stageResults.normalize._normalized;
      const result = await analyzeSemantics(diffs, impactResult, baseline, normalized);
      return {
        status: 'ok',
        schemaCompat: result.schemaCompat,
        semanticCompat: result.semanticCompat,
        risk: result.risk,
        confidence: result.confidence,
        classification: result.classification,
        _semantic: result
      };
    },
    async adapt() {
      const diffs = run.stageResults.detect._diffs;
      const semanticResult = run.stageResults.semantic._semantic;
      const result = generateAdapter(diffs, semanticResult, dependency);
      return {
        status: 'ok',
        generated: result.generated,
        reason: result.reason || null,
        adapterName: result.adapterName || null,
        type: result.type || null,
        mappings: result.mappings || [],
        adapterCode: result.adapterCode || null,
        risk: result.risk,
        _adapter: result
      };
    },
    async sandbox() {
      const adapterResult = run.stageResults.adapt._adapter;
      const currentData = run.stageResults.normalize._normalized.data;
      const baselineData = run.stageResults.baseline._baseline.data;
      const result = validateAdapter(adapterResult, currentData, baselineData);
      return {
        status: 'ok',
        passed: result.passed,
        skipped: result.skipped || false,
        reason: result.reason,
        tests: result.tests,
        recordsTested: result.recordsTested || 0,
        _sandbox: result
      };
    },
    async safety() {
      const semanticResult = run.stageResults.semantic._semantic;
      const sandboxResult = run.stageResults.sandbox._sandbox;
      const adapterResult = run.stageResults.adapt._adapter;
      const result = evaluateSafety(semanticResult, sandboxResult, adapterResult, config.pipeline);

      const statusUpdate = result.decision === 'auto-apply' ? 'auto-applied'
        : result.decision === 'blocked' ? 'blocked'
        : 'pending-review';
      store.updateDependency(dependency.id, { status: statusUpdate });

      return {
        status: 'ok',
        decision: result.decision,
        reason: result.reason,
        factors: result.factors,
        requiresHumanReview: result.requiresHumanReview,
        autoApplyAllowed: result.autoApplyAllowed
      };
    }
  };

  const handler = stageHandlers[stage];
  if (!handler) throw new Error(`Unknown pipeline stage: ${stage}`);
  return handler();
}

export function getPipelineStages() {
  return STAGES;
}
