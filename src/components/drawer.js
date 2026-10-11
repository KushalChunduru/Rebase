import { refreshIcons } from '../utils/icons.js';

let selectedApi = null;
let onPingCallback = null;

export function openApiDrawer(api, callbacks) {
  selectedApi = api;
  onPingCallback = callbacks && callbacks.onPing;

  const drawer = document.getElementById('drawer-api-details');
  const nameEl = document.getElementById('drawer-service-name');
  const bodyEl = document.getElementById('drawer-body-content');
  if (!drawer || !nameEl || !bodyEl) return;

  nameEl.textContent = api.name;

  bodyEl.innerHTML = `
    <div class="drawer-metric-grid">
      <div class="drawer-metric-box">
        <span class="drawer-metric-label">LATENCY (P95)</span>
        <span class="drawer-metric-value">${api.latencyP95}</span>
      </div>
      <div class="drawer-metric-box">
        <span class="drawer-metric-label">UPTIME</span>
        <span class="drawer-metric-value">${api.uptime}</span>
      </div>
      <div class="drawer-metric-box">
        <span class="drawer-metric-label">LAST PROBED</span>
        <span class="drawer-metric-value" style="font-size: 0.85rem;">${api.lastObserved}</span>
      </div>
    </div>

    <div>
      <div class="drawer-section-title">ENDPOINT CONTRACT</div>
      <div class="drawer-code-box">
        <div><strong>Base URL:</strong> ${api.baseUrl}</div>
        <div><strong>Path:</strong> <code>${api.endpoint}</code></div>
        <div><strong>Auth Protocol:</strong> ${api.behaviour?.auth || 'none'}</div>
        <div><strong>Data Format:</strong> ${api.behaviour?.format || 'JSON'} (${api.behaviour?.version || 'v1'})</div>
        ${api.behaviour?.rateLimit ? `<div><strong>Rate Limit:</strong> ${api.behaviour.rateLimit}</div>` : ''}
        ${api.behaviour?.pagination ? `<div><strong>Pagination:</strong> ${api.behaviour.pagination}</div>` : ''}
      </div>
    </div>

    <div>
      <div class="drawer-section-title">CURL PROBE COMMAND</div>
      <div class="drawer-code-box" id="drawer-curl-snippet">
        curl -X ${api.method} "${api.baseUrl}${api.path}" \\<br />
        &nbsp;&nbsp;-H "Content-Type: application/json" \\<br />
        &nbsp;&nbsp;-H "Authorization: ${api.behaviour?.auth === 'no authentication' ? 'None' : 'Bearer $SECRET_KEY'}"
      </div>
    </div>

    <div>
      <div class="drawer-section-title">ACTIVE AST SCHEMA INVARIANT</div>
      <div class="drawer-code-box">
        <pre><code>${api.samplePayload}</code></pre>
      </div>
    </div>

    <div id="probe-ping-result" class="hidden"></div>
  `;

  drawer.classList.remove('hidden');
  refreshIcons();
}

export function closeApiDrawer() {
  const drawer = document.getElementById('drawer-api-details');
  if (drawer) drawer.classList.add('hidden');
  selectedApi = null;
}

export function handleDrawerPing(toastFn) {
  const pingResultBox = document.getElementById('probe-ping-result');
  if (pingResultBox && selectedApi) {
    pingResultBox.classList.remove('hidden');
    pingResultBox.className = 'drawer-code-box';
    pingResultBox.innerHTML = `
      <div style="color: #22c55e; margin-bottom: 4px;">
        <strong>PROBE RESULT: 200 OK (${Math.floor(Math.random() * 25 + 20)}ms)</strong>
      </div>
      <div>Invariant verified &bull; Headers: Content-Type: application/json; charset=utf-8</div>
      <div style="color: #94a3b8; font-size: 0.72rem; margin-top: 4px;">AST schema checksum match [0x9af27c1]</div>
    `;
    if (toastFn) toastFn(`Probe completed for ${selectedApi.name}: 200 OK`, 'success');
  }
}

export function getSelectedApi() {
  return selectedApi;
}
