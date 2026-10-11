import { refreshIcons } from '../utils/icons.js';
import { defaultInspectObservation } from '../data/mock-data.js';

let currentObservation = null;
let onRemediateCallback = null;

export function openInspectModal(observation, callbacks) {
  const obs = observation || defaultInspectObservation;
  currentObservation = obs;
  onRemediateCallback = callbacks && callbacks.onRemediate;

  const modal = document.getElementById('modal-inspect-change');
  const body = document.getElementById('inspect-modal-body');
  const footer = document.getElementById('inspect-modal-footer');
  if (!modal || !body || !footer) return;

  body.innerHTML = `
    <div class="inspect-service-header">
      <div class="service-chip-wrap">
        <div class="service-icon-box ${obs.serviceIconBg}">
          <i data-lucide="${obs.serviceIcon}"></i>
        </div>
        <div>
          <h2 class="inspect-title">${obs.serviceName}</h2>
          <div class="inspect-sub">
            <code>${obs.serviceUrl}</code> &bull; <code>${obs.serviceEndpoint}</code>
          </div>
        </div>
      </div>
      <div class="inspect-severity-tag">
        <span class="pulse-orange-dot"></span>
        <span>SEVERITY: ${obs.severity}</span>
      </div>
    </div>

    <div class="diff-container">
      <div class="diff-header-row">
        <div class="diff-col-head">
          <span class="diff-ver">OBSERVED BASELINE (${obs.baselineVersion})</span>
          <span class="diff-status-tag ${obs.baselineStatusClass}">${obs.baselineStatusLabel}</span>
        </div>
        <div class="diff-col-head">
          <span class="diff-ver">LIVE CONTRACT DRIFT (${obs.currentVersion})</span>
          <span class="diff-status-tag ${obs.currentStatusClass}">${obs.currentStatusLabel}</span>
        </div>
      </div>

      <div class="diff-code-wrapper">
        <div class="diff-pane baseline-pane">
          <pre><code>${obs.baselineSchemaHtml}</code></pre>
        </div>
        <div class="diff-pane live-pane">
          <pre><code>${obs.currentSchemaHtml}</code></pre>
        </div>
      </div>
    </div>

    <div class="impact-section">
      <h4 class="impact-title">
        <i data-lucide="git-fork"></i>
        Potentially Affected Workflows (${obs.impacts.length} downstream pipelines)
      </h4>
      <div class="impact-list">
        ${obs.impacts.map(impact => `
          <div class="impact-card">
            <div class="impact-card-head">
              <span class="impact-name">${impact.name}</span>
              <span class="${impact.riskClass}">${impact.riskLabel}</span>
            </div>
            <p>${impact.description}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button class="btn-secondary" id="btn-dismiss-inspect">Dismiss</button>
    <button class="btn-primary-pill" id="btn-remediate-inspect">
      <i data-lucide="check-circle-2"></i>
      <span>${obs.remediateLabel}</span>
    </button>
  `;

  document.getElementById('btn-dismiss-inspect').addEventListener('click', closeInspectModal);
  document.getElementById('btn-remediate-inspect').addEventListener('click', handleRemediate);

  modal.classList.remove('hidden');
  refreshIcons();
}

export function closeInspectModal() {
  const modal = document.getElementById('modal-inspect-change');
  if (modal) modal.classList.add('hidden');
  currentObservation = null;
}

function handleRemediate() {
  if (onRemediateCallback && currentObservation) {
    onRemediateCallback(currentObservation);
  }
  closeInspectModal();
}
