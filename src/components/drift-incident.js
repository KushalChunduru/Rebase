import { refreshIcons } from '../utils/icons.js';

const STAGE_META = [
  { key: 'observe',   icon: 'eye',          label: 'Observe' },
  { key: 'normalize', icon: 'align-left',   label: 'Normalize' },
  { key: 'baseline',  icon: 'database',     label: 'Baseline' },
  { key: 'detect',    icon: 'scan-search',   label: 'Detect' },
  { key: 'analyze',   icon: 'target',       label: 'Impact' },
  { key: 'semantic',  icon: 'brain',        label: 'Semantic' },
  { key: 'adapt',     icon: 'wrench',       label: 'Adapter' },
  { key: 'sandbox',   icon: 'test-tubes',   label: 'Sandbox' },
  { key: 'safety',    icon: 'shield-check', label: 'Safety Gate' }
];

export function renderDriftIncidentPanel(container, data) {
  const { driftResult, pipelineRun, dependency } = data;
  const drift = driftResult?.drift || [];
  const hasPipeline = !!pipelineRun;
  const stages = pipelineRun?.stageResults || {};
  const safety = stages.safety;
  const semantic = stages.semantic;
  const adapt = stages.adapt;
  const sandbox = stages.sandbox;
  const analyze = stages.analyze;
  const detect = stages.detect;

  const decisionClass = safety?.decision === 'auto-apply' ? 'auto-fix'
    : safety?.decision === 'blocked' ? 'blocked' : 'review';

  container.innerHTML = `
    <div class="drift-incident-panel">
      <div class="drift-incident-header">
        <div class="drift-incident-title-row">
          <div class="drift-incident-icon ${decisionClass}">
            <i data-lucide="${safety?.decision === 'auto-apply' ? 'shield-check' : safety?.decision === 'blocked' ? 'shield-x' : 'alert-triangle'}"></i>
          </div>
          <div>
            <h3 class="drift-incident-title">${dependency?.name || 'Dependency'} — Drift Incident</h3>
            <p class="drift-incident-subtitle">${driftResult?.label || `${drift.length} schema change(s) detected`}</p>
          </div>
          <span class="drift-incident-badge ${decisionClass}">
            ${safety?.decision === 'auto-apply' ? 'AUTO-APPLIED' : safety?.decision === 'blocked' ? 'BLOCKED' : hasPipeline ? 'HUMAN REVIEW' : 'DETECTED'}
          </span>
          <button class="drift-incident-close" id="drift-incident-close">
            <i data-lucide="x"></i>
          </button>
        </div>
      </div>

      ${renderDiffSection(drift, driftResult)}
      ${hasPipeline ? renderPipelineTimeline(pipelineRun) : ''}
      ${analyze ? renderImpactSection(analyze) : ''}
      ${semantic ? renderSemanticSection(semantic) : ''}
      ${adapt?.generated ? renderAdapterSection(adapt) : ''}
      ${sandbox && !sandbox.skipped ? renderSandboxSection(sandbox) : ''}
      ${safety ? renderSafetySection(safety) : ''}
    </div>
  `;

  container.classList.remove('hidden');
  refreshIcons();

  container.querySelector('#drift-incident-close')?.addEventListener('click', () => {
    container.classList.add('hidden');
    container.innerHTML = '';
  });

  const adapterToggle = container.querySelector('#adapter-toggle');
  if (adapterToggle) {
    adapterToggle.addEventListener('click', () => {
      const code = container.querySelector('#adapter-code-block');
      if (code) code.classList.toggle('hidden');
      adapterToggle.textContent = code?.classList.contains('hidden') ? 'Show Code ▾' : 'Hide Code ▴';
    });
  }
}

function renderDiffSection(drift, driftResult) {
  if (!drift.length) return '';

  const baselineSchema = driftResult?.baselineSchema || driftResult?.observation?.baselineSchema || {};
  const currentSchema = driftResult?.currentSchema || driftResult?.observation?.currentSchema || {};

  const rows = drift.map(d => {
    const icon = d.change === 'removed' ? 'minus' : d.change === 'added' ? 'plus' : 'arrow-right';
    const cls = d.change === 'removed' ? 'removed' : d.change === 'added' ? 'added' : 'changed';
    const detail = d.change === 'type_changed' ? `${d.was} → ${d.now}` : d.change;
    return `
      <div class="drift-diff-row ${cls}">
        <i data-lucide="${icon}"></i>
        <span class="drift-diff-field">${d.field}</span>
        <span class="drift-diff-detail">${detail}</span>
      </div>`;
  }).join('');

  const beforeFields = Object.entries(baselineSchema).slice(0, 12).map(([k, v]) => {
    const isChanged = drift.some(d => d.field === k);
    return `<span class="${isChanged ? 'drift-highlight removed' : ''}">${k}: <em>${v}</em></span>`;
  }).join('\n');

  const afterFields = Object.entries(currentSchema).slice(0, 12).map(([k, v]) => {
    const isChanged = drift.some(d => d.field === k);
    return `<span class="${isChanged ? 'drift-highlight added' : ''}">${k}: <em>${v}</em></span>`;
  }).join('\n');

  return `
    <div class="drift-section">
      <h4 class="drift-section-title"><i data-lucide="diff"></i> Schema Diff</h4>
      <div class="drift-diff-list">${rows}</div>
      ${beforeFields || afterFields ? `
      <div class="drift-schema-compare">
        <div class="drift-schema-pane baseline">
          <div class="drift-schema-label">BASELINE</div>
          <pre class="drift-schema-code">${beforeFields}</pre>
        </div>
        <div class="drift-schema-pane current">
          <div class="drift-schema-label">CURRENT</div>
          <pre class="drift-schema-code">${afterFields}</pre>
        </div>
      </div>` : ''}
    </div>`;
}

function renderPipelineTimeline(run) {
  const completed = new Set(run.completedStages || []);
  const results = run.stageResults || {};

  const steps = STAGE_META.map(s => {
    const result = results[s.key];
    let status = 'pending';
    if (completed.has(s.key)) {
      if (result?.halt) status = 'halted';
      else if (s.key === 'safety' && result?.decision === 'blocked') status = 'blocked';
      else status = 'done';
    }

    let detail = '';
    if (result) {
      if (s.key === 'observe') detail = `${result.latencyMs}ms`;
      if (s.key === 'detect') detail = result.changed ? `${result.diffCount} diff(s)` : 'No changes';
      if (s.key === 'analyze') detail = `${result.totalAffected} affected`;
      if (s.key === 'semantic') detail = `${result.risk} risk`;
      if (s.key === 'adapt') detail = result.generated ? 'Generated' : 'Skipped';
      if (s.key === 'sandbox') detail = result.passed ? `${result.tests?.length || 0} passed` : 'Failed';
      if (s.key === 'safety') detail = result.decision?.replace('-', ' ');
    }

    return `
      <div class="drift-stage ${status}">
        <div class="drift-stage-dot">
          <i data-lucide="${status === 'done' ? 'check' : status === 'blocked' ? 'x' : status === 'halted' ? 'pause' : s.icon}"></i>
        </div>
        <div class="drift-stage-info">
          <span class="drift-stage-label">${s.label}</span>
          ${detail ? `<span class="drift-stage-detail">${detail}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const elapsed = run.completedAt && run.startedAt
    ? ((new Date(run.completedAt) - new Date(run.startedAt)) / 1000).toFixed(1)
    : '?';

  return `
    <div class="drift-section">
      <h4 class="drift-section-title"><i data-lucide="activity"></i> Pipeline Execution <span class="drift-elapsed">${elapsed}s</span></h4>
      <div class="drift-pipeline-timeline">${steps}</div>
    </div>`;
}

function renderImpactSection(analyze) {
  if (!analyze.impacts?.length) return '';

  const rows = analyze.impacts.map(imp => {
    const riskCls = imp.riskLevel === 'CRITICAL' ? 'critical' : imp.riskLevel === 'HIGH' ? 'high' : imp.riskLevel === 'MEDIUM' ? 'moderate' : 'low';
    return `
      <div class="drift-impact-row">
        <span class="drift-impact-risk ${riskCls}">${imp.riskLevel}</span>
        <span class="drift-impact-name">${imp.workflow}</span>
        <span class="drift-impact-reason">${imp.affectedBy.join(', ')}</span>
      </div>`;
  }).join('');

  return `
    <div class="drift-section">
      <h4 class="drift-section-title"><i data-lucide="target"></i> Impact Analysis — ${analyze.totalAffected} workflow(s)</h4>
      <div class="drift-impact-list">${rows}</div>
    </div>`;
}

function renderSemanticSection(semantic) {
  const riskColors = { LOW: '#4ade80', MODERATE: '#facc15', HIGH: '#fa4d1e', CRITICAL: '#fa4d1e' };
  const riskColor = riskColors[semantic.risk] || '#94a3b8';

  return `
    <div class="drift-section">
      <h4 class="drift-section-title"><i data-lucide="brain"></i> Semantic Analysis</h4>
      <div class="drift-semantic-grid">
        <div class="drift-semantic-bar">
          <span>Schema Compat</span>
          <div class="drift-bar-track"><div class="drift-bar-fill" style="width:${semantic.schemaCompat}%;background:${semantic.schemaCompat > 80 ? '#4ade80' : '#facc15'}"></div></div>
          <span>${semantic.schemaCompat}%</span>
        </div>
        <div class="drift-semantic-bar">
          <span>Semantic Compat</span>
          <div class="drift-bar-track"><div class="drift-bar-fill" style="width:${semantic.semanticCompat}%;background:${semantic.semanticCompat > 50 ? '#4ade80' : '#fa4d1e'}"></div></div>
          <span>${semantic.semanticCompat}%</span>
        </div>
        <div class="drift-semantic-bar">
          <span>Risk</span>
          <span class="drift-risk-tag" style="color:${riskColor}">${semantic.risk}</span>
          <span>Confidence: ${semantic.confidence}%</span>
        </div>
      </div>
      <p class="drift-classification">${semantic.classification}</p>
    </div>`;
}

function renderAdapterSection(adapt) {
  const mappings = (adapt.mappings || []).map(m =>
    `<span class="drift-mapping">${m.from} → ${m.to} <em>(${m.kind})</em></span>`
  ).join('');

  return `
    <div class="drift-section">
      <h4 class="drift-section-title"><i data-lucide="wrench"></i> Generated Adapter — <code>${adapt.adapterName}</code></h4>
      <div class="drift-adapter-meta">
        <span>Type: ${adapt.type}</span>
        ${mappings}
        <button class="drift-adapter-toggle" id="adapter-toggle">Show Code ▾</button>
      </div>
      <pre class="drift-adapter-code hidden" id="adapter-code-block"><code>${escapeHtml(adapt.adapterCode || '')}</code></pre>
    </div>`;
}

function renderSandboxSection(sandbox) {
  const tests = (sandbox.tests || []).map(t => `
    <div class="drift-test-row ${t.passed ? 'pass' : 'fail'}">
      <i data-lucide="${t.passed ? 'check-circle' : 'x-circle'}"></i>
      <span class="drift-test-name">${t.name}</span>
      <span class="drift-test-detail">${t.detail}</span>
    </div>`).join('');

  const passCount = (sandbox.tests || []).filter(t => t.passed).length;
  const total = (sandbox.tests || []).length;

  return `
    <div class="drift-section">
      <h4 class="drift-section-title"><i data-lucide="test-tubes"></i> Sandbox Validation — ${passCount}/${total} passed, ${sandbox.recordsTested} record(s)</h4>
      <div class="drift-test-list">${tests}</div>
    </div>`;
}

function renderSafetySection(safety) {
  const cls = safety.decision === 'auto-apply' ? 'auto-fix'
    : safety.decision === 'blocked' ? 'blocked' : 'review';
  const icon = safety.decision === 'auto-apply' ? 'shield-check'
    : safety.decision === 'blocked' ? 'shield-x' : 'eye';
  const title = safety.decision === 'auto-apply' ? 'AUTO-FIX APPLIED'
    : safety.decision === 'blocked' ? 'AUTO-FIX BLOCKED' : 'HUMAN REVIEW REQUIRED';

  const factors = safety.factors || {};

  return `
    <div class="drift-section">
      <div class="drift-safety-banner ${cls}">
        <div class="drift-safety-icon"><i data-lucide="${icon}"></i></div>
        <div class="drift-safety-body">
          <div class="drift-safety-title">${title}</div>
          <div class="drift-safety-reason">${safety.reason}</div>
          <div class="drift-safety-factors">
            <span>Confidence: ${factors.confidence}%</span>
            <span>Risk: ${factors.risk}</span>
            <span>Schema: ${factors.schemaCompat}%</span>
            <span>Semantic: ${factors.semanticCompat}%</span>
            <span>Sandbox: ${factors.sandboxPassed ? '✓' : '✗'}</span>
            <span>Adapter: ${factors.adapterGenerated ? '✓' : '✗'}</span>
          </div>
        </div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
