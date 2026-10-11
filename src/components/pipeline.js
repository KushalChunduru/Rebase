import { refreshIcons } from '../utils/icons.js';
import { apiService } from '../services/api-service.js';
import { SIMULATION_SCENARIOS, STEP_ORDER, STEP_LABELS, STEP_ICONS } from '../data/mock-data.js';

const BACKEND_STAGE_MAP = {
  observe: { step: 'detecting', label: 'OBSERVE' },
  normalize: { step: 'detecting', label: 'NORMALIZE' },
  baseline: { step: 'detecting', label: 'BASELINE' },
  detect: { step: 'detecting', label: 'DETECT' },
  analyze: { step: 'analyzing', label: 'ANALYZE' },
  semantic: { step: 'analyzing', label: 'SEMANTIC' },
  adapt: { step: 'repairing', label: 'ADAPT' },
  sandbox: { step: 'testing', label: 'SANDBOX' },
  safety: { step: 'decision', label: 'SAFETY GATE' }
};

let pipelineState = {
  active: false,
  scenarioId: null,
  currentStep: -1,
  timers: [],
  startTime: null,
  elapsedInterval: null,
  onComplete: null,
  mode: 'mock'
};

export function startPipeline(scenarioId, callbacks) {
  if (pipelineState.active) return;

  pipelineState.active = true;
  pipelineState.scenarioId = scenarioId;
  pipelineState.currentStep = -1;
  pipelineState.timers = [];
  pipelineState.startTime = Date.now();
  pipelineState.onComplete = callbacks && callbacks.onComplete;

  const modal = document.getElementById('modal-pipeline');
  modal.classList.remove('hidden');

  document.getElementById('pipeline-step-content').innerHTML = '';
  document.getElementById('pipeline-stage-label').textContent = 'Initializing...';
  document.getElementById('pipeline-elapsed').textContent = '0.0s';
  renderProgressTracker(-1, false, false);

  pipelineState.elapsedInterval = setInterval(() => {
    const elapsed = ((Date.now() - pipelineState.startTime) / 1000).toFixed(1);
    document.getElementById('pipeline-elapsed').textContent = elapsed + 's';
  }, 100);

  refreshIcons();

  if (callbacks && callbacks.useBackend) {
    pipelineState.mode = 'backend';
    runBackendPipeline(scenarioId, callbacks);
  } else {
    pipelineState.mode = 'mock';
    runMockPipeline(scenarioId);
  }
}

// ── Backend-driven pipeline ──

async function runBackendPipeline(scenarioId, callbacks) {
  const scenarioConfig = {
    'api-rename': {
      mutationId: 'api-field-rename',
      dependencyId: 'customer-directory',
      title: 'API Field Rename Detected',
      subtitle: 'Customer Directory API — GET /users',
      iconClass: 'bg-lime',
      headerIcon: 'arrow-right-left'
    },
    'mcp-danger': {
      mutationId: 'mcp-semantic-shift',
      dependencyId: 'user-auth-mcp',
      title: 'MCP Semantic Danger Detected',
      subtitle: 'User Auth MCP Server — delete_user tool',
      iconClass: 'bg-red',
      headerIcon: 'shield-alert'
    },
    'webhook-rename': {
      mutationId: 'webhook-event-rename',
      dependencyId: 'stripe-webhooks',
      title: 'Webhook Event Rename Detected',
      subtitle: 'Stripe Webhooks — Payment Events',
      iconClass: 'bg-purple',
      headerIcon: 'webhook'
    }
  };

  const config = scenarioConfig[scenarioId];
  if (!config) {
    showPipelineError('Unknown scenario');
    return;
  }

  renderScenarioHeader(config);

  try {
    updateStageLabel('Applying mutation...');
    await apiService.simulatorApplyMutation(config.mutationId);
    await animateDelay(400);

    updateStageLabel('Running pipeline...');
    renderProgressTracker(0, false, false);
    await animateDelay(300);

    const run = await apiService.runPipeline(config.dependencyId);
    await renderBackendResults(run, config);

    if (pipelineState.onComplete) {
      pipelineState.onComplete(run, scenarioId);
    }
  } catch (err) {
    showPipelineError(err.message);
  } finally {
    pipelineState.active = false;
    clearInterval(pipelineState.elapsedInterval);
  }
}

async function renderBackendResults(run, config) {
  const stages = ['observe', 'normalize', 'baseline', 'detect', 'analyze', 'semantic', 'adapt', 'sandbox', 'safety'];
  const stageResults = run.stageResults || {};

  for (let i = 0; i < stages.length; i++) {
    if (!pipelineState.active) return;
    const stage = stages[i];
    const result = stageResults[stage];
    if (!result) continue;

    const mapping = BACKEND_STAGE_MAP[stage];
    const stepIdx = STEP_ORDER.indexOf(mapping.step);

    updateStageLabel(mapping.label + '...');
    renderProgressTracker(stepIdx, false, false);

    if (stage === 'detect' && result.changed) {
      renderBackendDetectContent(stageResults, config);
      await animateDelay(1200);
    }

    if (stage === 'semantic') {
      renderBackendAnalyzeContent(stageResults);
      await animateDelay(1800);
    }

    if (stage === 'adapt') {
      const isBlocked = !result.generated;
      if (isBlocked) {
        renderProgressTracker(2, false, true);
      } else {
        renderBackendAdaptContent(result);
        await animateDelay(1200);
      }
    }

    if (stage === 'sandbox') {
      if (result.skipped) {
        renderProgressTracker(3, false, true);
      } else {
        renderBackendSandboxContent(result);
        await animateDelay(1200);
      }
    }

    if (stage === 'safety') {
      const isBlocked = result.decision === 'blocked';
      renderProgressTracker(4, isBlocked, false);
      renderBackendDecisionContent(result);
      updateStageLabel(isBlocked ? 'BLOCKED' : result.decision === 'auto-apply' ? 'COMPLETE' : 'REVIEW');
    }

    if (!['detect', 'semantic', 'adapt', 'sandbox', 'safety'].includes(stage)) {
      await animateDelay(300);
    }
  }
}

function renderBackendDetectContent(stageResults, config) {
  const detect = stageResults.detect;
  const contentEl = document.getElementById('pipeline-step-content');

  contentEl.innerHTML = `
    <div class="step-content-card">
      <div class="step-content-header">
        <i data-lucide="scan-search"></i>
        <span>Change Detected — ${detect.diffCount} diff(s)</span>
      </div>
      <p class="step-diff-summary">${detect.summary}</p>
    </div>`;
  refreshIcons();
}

function renderBackendAnalyzeContent(stageResults) {
  const semantic = stageResults.semantic;
  const analyze = stageResults.analyze;
  const riskColors = { LOW: '#4ade80', MODERATE: '#facc15', HIGH: '#fa4d1e', CRITICAL: '#fa4d1e' };
  const riskColor = riskColors[semantic.risk] || '#4ade80';
  const contentEl = document.getElementById('pipeline-step-content');

  contentEl.innerHTML = `
    <div class="step-content-card">
      <div class="step-content-header">
        <i data-lucide="brain"></i>
        <span>Compatibility Analysis</span>
      </div>
      <div class="analysis-results">
        <div class="analysis-row">
          <span class="analysis-label">Schema Compatibility</span>
          <div class="analysis-bar-track"><div class="analysis-bar-fill" style="width:${semantic.schemaCompat}%;background:${semantic.schemaCompat > 80 ? '#4ade80' : '#facc15'}"></div></div>
          <span class="analysis-value">${semantic.schemaCompat}%</span>
        </div>
        <div class="analysis-row">
          <span class="analysis-label">Semantic Compatibility</span>
          <div class="analysis-bar-track"><div class="analysis-bar-fill" style="width:${semantic.semanticCompat}%;background:${semantic.semanticCompat > 50 ? '#4ade80' : '#fa4d1e'}"></div></div>
          <span class="analysis-value">${semantic.semanticCompat}%</span>
        </div>
        <div class="analysis-row">
          <span class="analysis-label">Risk Level</span>
          <span class="analysis-classification" style="color:${riskColor};font-weight:700">${semantic.risk}</span>
        </div>
        <div class="analysis-row">
          <span class="analysis-label">Confidence</span>
          <span class="analysis-value">${semantic.confidence}%</span>
        </div>
        <div class="analysis-row">
          <span class="analysis-label">Workflows Affected</span>
          <span class="analysis-value">${analyze.totalAffected}</span>
        </div>
      </div>
      <p class="analysis-detail">${semantic.classification}</p>
    </div>`;
  refreshIcons();
}

function renderBackendAdaptContent(result) {
  const contentEl = document.getElementById('pipeline-step-content');
  const codeHtml = escapeHtml(result.adapterCode || '');
  contentEl.innerHTML = `
    <div class="step-content-card">
      <div class="step-content-header">
        <i data-lucide="wrench"></i>
        <span>Generated Compatibility Adapter</span>
      </div>
      <div class="repair-code-block"><pre>${codeHtml}</pre></div>
      <div style="margin-top:8px;color:#94a3b8;font-size:0.75rem">
        Type: ${result.type} &bull; ${result.mappings.length} mapping(s)
      </div>
    </div>`;
  refreshIcons();
}

function renderBackendSandboxContent(result) {
  const contentEl = document.getElementById('pipeline-step-content');
  const rows = (result.tests || []).map(t => `
    <div class="test-result-row">
      <span class="test-result-icon ${t.passed ? 'pass' : 'fail'}">
        <i data-lucide="${t.passed ? 'check' : 'x'}"></i>
      </span>
      <span class="test-result-name">${t.name}: ${t.detail}</span>
    </div>`).join('');

  contentEl.innerHTML = `
    <div class="step-content-card">
      <div class="step-content-header">
        <i data-lucide="test-tubes"></i>
        <span>Sandbox Validation — ${result.recordsTested} record(s) tested</span>
      </div>
      <div class="test-results-list">${rows}</div>
    </div>`;
  refreshIcons();
}

function renderBackendDecisionContent(result) {
  const isBlocked = result.decision === 'blocked';
  const isAutoApply = result.decision === 'auto-apply';
  const bannerClass = isBlocked ? 'blocked' : 'auto-fix';
  const icon = isBlocked ? 'shield-x' : isAutoApply ? 'shield-check' : 'eye';
  const title = isBlocked ? 'AUTO-FIX BLOCKED' : isAutoApply ? 'AUTO-FIX APPLIED' : 'HUMAN REVIEW REQUIRED';
  const contentEl = document.getElementById('pipeline-step-content');

  contentEl.innerHTML = `
    <div class="step-content-card">
      <div class="decision-banner ${bannerClass}">
        <div class="decision-icon">
          <i data-lucide="${icon}"></i>
        </div>
        <div class="decision-title">${title}</div>
        <div class="decision-detail">${result.reason}</div>
      </div>
    </div>`;
  refreshIcons();
}

function renderScenarioHeader(config) {
  const scenarioInfo = document.getElementById('pipeline-scenario-info');
  scenarioInfo.innerHTML = `
    <div class="pipeline-scenario-icon ${config.iconClass}">
      <i data-lucide="${config.headerIcon}"></i>
    </div>
    <div class="pipeline-scenario-text">
      <div class="pipeline-scenario-title">${config.title}</div>
      <div class="pipeline-scenario-sub">${config.subtitle}</div>
    </div>
  `;
  refreshIcons();
}

function showPipelineError(message) {
  const contentEl = document.getElementById('pipeline-step-content');
  contentEl.innerHTML = `
    <div class="step-content-card">
      <div class="decision-banner blocked">
        <div class="decision-icon"><i data-lucide="alert-triangle"></i></div>
        <div class="decision-title">Pipeline Error</div>
        <div class="decision-detail">${escapeHtml(message)}</div>
      </div>
    </div>`;
  updateStageLabel('ERROR');
  pipelineState.active = false;
  clearInterval(pipelineState.elapsedInterval);
  refreshIcons();
}

function updateStageLabel(text) {
  const el = document.getElementById('pipeline-stage-label');
  if (el) el.textContent = text;
}

function animateDelay(ms) {
  return new Promise(resolve => {
    const t = setTimeout(resolve, ms);
    pipelineState.timers.push(t);
  });
}

// ── Mock pipeline (fallback when backend is offline) ──

function runMockPipeline(scenarioId) {
  const scenario = SIMULATION_SCENARIOS[scenarioId];
  if (!scenario) return;

  renderScenarioHeader({
    title: scenario.title,
    subtitle: scenario.subtitle,
    iconClass: scenario.iconClass,
    headerIcon: scenario.headerIcon
  });

  const t = setTimeout(() => advanceMockStep(scenarioId), 600);
  pipelineState.timers.push(t);
}

function advanceMockStep(scenarioId) {
  const scenario = SIMULATION_SCENARIOS[scenarioId];
  if (!scenario || !pipelineState.active) return;

  pipelineState.currentStep++;
  const stepIndex = pipelineState.currentStep;

  if (stepIndex >= STEP_ORDER.length) {
    finishMockPipeline(scenarioId);
    return;
  }

  const stepKey = STEP_ORDER[stepIndex];
  const isDanger = scenarioId === 'mcp-danger';

  if (isDanger && (stepKey === 'repairing' || stepKey === 'testing')) {
    renderProgressTracker(stepIndex, false, true);
    const t = setTimeout(() => advanceMockStep(scenarioId), 400);
    pipelineState.timers.push(t);
    return;
  }

  const isError = isDanger && stepKey === 'decision';
  renderProgressTracker(stepIndex, isError, false);

  updateStageLabel(STEP_LABELS[stepIndex] + '...');

  const contentEl = document.getElementById('pipeline-step-content');
  contentEl.innerHTML = renderMockStepContent(scenarioId, stepKey);
  refreshIcons();

  const isLast = stepKey === 'decision';
  if (!isLast) {
    const delay = stepKey === 'analyzing' ? 2200 : 1500;
    const t = setTimeout(() => advanceMockStep(scenarioId), delay);
    pipelineState.timers.push(t);
  } else {
    const outcome = scenario.steps.decision.outcome;
    updateStageLabel(outcome === 'blocked' ? 'BLOCKED' : 'COMPLETE');
    finishMockPipeline(scenarioId);
  }
}

function finishMockPipeline(scenarioId) {
  pipelineState.active = false;
  clearInterval(pipelineState.elapsedInterval);
  const scenario = SIMULATION_SCENARIOS[scenarioId];
  if (pipelineState.onComplete) {
    pipelineState.onComplete(scenario, scenarioId);
  }
}

function renderMockStepContent(scenarioId, stepKey) {
  const scenario = SIMULATION_SCENARIOS[scenarioId];
  const stepData = scenario.steps[stepKey];

  if (stepKey === 'detecting') {
    return `
      <div class="step-content-card">
        <div class="step-content-header">
          <i data-lucide="scan-search"></i>
          <span>Schema Diff Detected</span>
        </div>
        <p class="step-diff-summary">${stepData.diffSummary}</p>
        <div class="step-diff-grid">
          <div class="step-diff-pane old">
            <div class="step-diff-label">BEFORE (v1)</div>
            <pre class="step-diff-code">${highlightDiff(stepData.oldSchema, stepData.highlightOld, 'removed')}</pre>
          </div>
          <div class="step-diff-pane new">
            <div class="step-diff-label">AFTER (v2)</div>
            <pre class="step-diff-code">${highlightDiff(stepData.newSchema, stepData.highlightNew, 'added')}</pre>
          </div>
        </div>
      </div>`;
  }

  if (stepKey === 'analyzing') {
    const riskColors = { safe: '#4ade80', moderate: '#facc15', danger: '#fa4d1e' };
    const riskColor = riskColors[stepData.riskClass] || '#4ade80';
    return `
      <div class="step-content-card">
        <div class="step-content-header">
          <i data-lucide="brain"></i>
          <span>Compatibility Analysis</span>
        </div>
        <div class="analysis-results">
          <div class="analysis-row">
            <span class="analysis-label">Schema Compatibility</span>
            <div class="analysis-bar-track"><div class="analysis-bar-fill" style="width:${stepData.schemaCompat}%;background:${stepData.schemaCompat > 80 ? '#4ade80' : '#facc15'}"></div></div>
            <span class="analysis-value">${stepData.schemaCompat}%</span>
          </div>
          <div class="analysis-row">
            <span class="analysis-label">Semantic Compatibility</span>
            <div class="analysis-bar-track"><div class="analysis-bar-fill" style="width:${stepData.semanticCompat}%;background:${stepData.semanticCompat > 50 ? '#4ade80' : '#fa4d1e'}"></div></div>
            <span class="analysis-value">${stepData.semanticCompat}%</span>
          </div>
          <div class="analysis-row">
            <span class="analysis-label">Risk Level</span>
            <span class="analysis-classification ${stepData.riskClass}" style="color:${riskColor}">${stepData.risk}</span>
          </div>
          <div class="analysis-row">
            <span class="analysis-label">Confidence</span>
            <span class="analysis-value">${stepData.confidence}%</span>
          </div>
        </div>
        <p class="analysis-detail">${stepData.classification}</p>
      </div>`;
  }

  if (stepKey === 'repairing') {
    return `
      <div class="step-content-card">
        <div class="step-content-header">
          <i data-lucide="wrench"></i>
          <span>Generated Compatibility Adapter</span>
        </div>
        <div class="repair-code-block"><pre>${stepData.adapterCode}</pre></div>
      </div>`;
  }

  if (stepKey === 'testing') {
    const rows = stepData.results.map(r => `
      <div class="test-result-row">
        <span class="test-result-icon ${r.pass ? 'pass' : 'fail'}">
          <i data-lucide="${r.pass ? 'check' : 'x'}"></i>
        </span>
        <span class="test-result-name">${r.test}</span>
      </div>`).join('');
    return `
      <div class="step-content-card">
        <div class="step-content-header">
          <i data-lucide="test-tubes"></i>
          <span>Sandbox Regression Tests</span>
        </div>
        <div class="test-results-list">${rows}</div>
      </div>`;
  }

  if (stepKey === 'decision') {
    const isBlocked = stepData.outcome === 'blocked';
    return `
      <div class="step-content-card">
        <div class="decision-banner ${isBlocked ? 'blocked' : 'auto-fix'}">
          <div class="decision-icon">
            <i data-lucide="${isBlocked ? 'shield-x' : 'shield-check'}"></i>
          </div>
          <div class="decision-title">${stepData.message}</div>
          <div class="decision-detail">${stepData.detail}</div>
        </div>
      </div>`;
  }

  return '';
}

// ── Shared UI helpers ──

export function abortPipeline() {
  pipelineState.timers.forEach(t => clearTimeout(t));
  clearInterval(pipelineState.elapsedInterval);
  pipelineState.active = false;
  pipelineState.currentStep = -1;
  pipelineState.timers = [];

  const modal = document.getElementById('modal-pipeline');
  if (modal) modal.classList.add('hidden');
}

export function isPipelineActive() {
  return pipelineState.active;
}

export function isPipelineModalOpen() {
  const modal = document.getElementById('modal-pipeline');
  return modal && !modal.classList.contains('hidden');
}

function renderProgressTracker(activeIndex, isError, isSkipped) {
  const progressEl = document.getElementById('pipeline-progress');
  if (!progressEl) return;

  let html = '';
  for (let i = 0; i < STEP_ORDER.length; i++) {
    let state = '';
    if (i < activeIndex) state = 'complete';
    else if (i === activeIndex) state = isError ? 'error' : 'active';

    if (isSkipped && i === activeIndex) state = 'skipped';

    if (pipelineState.mode === 'mock') {
      const isDanger = pipelineState.scenarioId === 'mcp-danger';
      if (isDanger && (i === 2 || i === 3) && activeIndex > i) state = 'skipped';
    }

    html += `
      <div class="pipeline-step-indicator ${state}">
        <div class="step-circle">
          <i data-lucide="${STEP_ICONS[i]}"></i>
        </div>
        <span class="step-label">${STEP_LABELS[i]}</span>
      </div>
    `;
    if (i < STEP_ORDER.length - 1) {
      const connFilled = i < activeIndex ? 'filled' : '';
      html += `<div class="step-connector ${connFilled}"></div>`;
    }
  }
  progressEl.innerHTML = html;
  refreshIcons();
}

function highlightDiff(code, highlight, type) {
  if (!highlight) return escapeHtml(code);
  const escaped = escapeHtml(code);
  const escapedHighlight = escapeHtml(highlight);
  return escaped.replace(escapedHighlight, `<span class="diff-${type}">${escapedHighlight}</span>`);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
