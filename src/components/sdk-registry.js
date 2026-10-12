import { apiService } from '../services/api-service.js';
import { refreshIcons } from '../utils/icons.js';
import { showToast } from './toast.js';

const LANG_ICONS = {
  Python:     'terminal',
  JavaScript: 'code',
  Go:         'box',
  Rust:       'cog'
};

const LANG_COLORS = {
  Python:     'bg-blue',
  JavaScript: 'bg-emerald',
  Go:         'bg-cyan',
  Rust:       'bg-orange'
};

let sdkData = [];
let selectedSdk = null;

export async function initSdkRegistry() {
  try {
    sdkData = await apiService.getSdks();
  } catch {
    sdkData = [];
  }
  renderSdkCards();
  attachSdkListeners();
}

export function handleSdkWebSocketMessage(data) {
  if (data.type !== 'sdk:observed') return;

  const idx = sdkData.findIndex(s => s.id === data.dependencyId);
  if (idx >= 0) {
    sdkData[idx] = {
      ...sdkData[idx],
      latestVersion: data.latestVersion,
      lastCheckedAt: data.timestamp,
      lastLatencyMs: data.latencyMs,
      deprecated: data.deprecated,
      status: data.majorDrift ? 'change-detected' : 'monitoring'
    };
  }

  addObsFeedItem(data);
  renderSdkCards();

  if (selectedSdk && selectedSdk.id === data.dependencyId && idx >= 0) {
    showSdkDetail(sdkData[idx]);
  }
}

function renderSdkCards() {
  const grid = document.getElementById('sdk-cards-grid');
  const countTag = document.getElementById('sdk-count-tag');
  if (!grid) return;

  if (countTag) countTag.textContent = `${sdkData.length} PACKAGES TRACKED`;

  if (sdkData.length === 0) {
    grid.innerHTML = '<p style="color:#636773;padding:20px;">No SDKs registered. Backend may be offline.</p>';
    return;
  }

  grid.innerHTML = sdkData.map(sdk => {
    const icon = LANG_ICONS[sdk.language] || 'package';
    const colorClass = LANG_COLORS[sdk.language] || 'bg-purple';
    const { badgeClass, badgeLabel } = getSdkBadge(sdk);
    const version = sdk.pinnedVersion || '—';
    const latest = sdk.latestVersion;
    const versionDrift = latest && version !== latest;
    const majorDrift = versionDrift && isMajorBump(version, latest);
    const versionPillClass = majorDrift ? 'version-major' : versionDrift ? 'version-behind' : latest ? 'version-latest' : '';
    const versionLabel = latest ? `v${version} → v${latest}` : `v${version}`;
    const checked = sdk.lastCheckedAt ? timeAgo(sdk.lastCheckedAt) : 'Not checked';
    const methodCount = (sdk.methods || []).length;

    return `
      <div class="dep-card sdk-card" data-sdk-id="${sdk.id}">
        <div class="dep-card-top">
          <div class="dep-card-icon ${colorClass}"><i data-lucide="${icon}"></i></div>
          <span class="dep-card-badge ${badgeClass}"><span class="status-pulse-dot"></span> ${badgeLabel}</span>
        </div>
        <h3 class="dep-card-name">${sdk.name}</h3>
        <p class="dep-card-desc">${sdk.description}</p>
        <div class="dep-card-meta">
          <span class="dep-meta-pill ${versionPillClass}">${versionLabel}</span>
          <span class="dep-meta-pill lang">${sdk.language}</span>
          <span class="dep-meta-pill">${sdk.registry}</span>
        </div>
        <div class="dep-card-footer">
          <span>Checked: ${checked}</span>
          <span>${methodCount} methods tracked</span>
        </div>
      </div>
    `;
  }).join('');

  refreshIcons();
}

function getSdkBadge(sdk) {
  if (sdk.deprecated) return { badgeClass: 'review-required', badgeLabel: 'Deprecated' };
  if (!sdk.latestVersion) return { badgeClass: 'monitoring', badgeLabel: 'Healthy' };

  const vDrift = sdk.pinnedVersion !== sdk.latestVersion;
  if (!vDrift) return { badgeClass: 'monitoring', badgeLabel: 'Up to Date' };

  const major = isMajorBump(sdk.pinnedVersion, sdk.latestVersion);
  if (major) return { badgeClass: 'major-drift', badgeLabel: 'Major Update' };
  return { badgeClass: 'version-drift', badgeLabel: 'Update Available' };
}

function addObsFeedItem(data) {
  const bar = document.getElementById('sdk-obs-bar');
  if (!bar) return;

  const empty = document.getElementById('sdk-obs-empty');
  if (empty) empty.remove();

  const time = new Date().toTimeString().slice(0, 8);
  const dotClass = data.majorDrift ? 'major' : data.versionDrift ? 'drift' : 'ok';
  const vClass = data.majorDrift ? 'major' : data.versionDrift ? 'drift' : '';
  let msg;
  if (data.majorDrift) msg = `MAJOR version drift — v${data.pinnedVersion} → v${data.latestVersion}`;
  else if (data.versionDrift) msg = `Minor/patch update available — v${data.pinnedVersion} → v${data.latestVersion}`;
  else msg = `Up to date at v${data.latestVersion}`;

  const item = document.createElement('div');
  item.className = 'sdk-obs-item';
  item.innerHTML = `
    <span class="sdk-obs-dot ${dotClass}"></span>
    <span class="sdk-obs-name">${data.name}</span>
    <span class="sdk-obs-msg">${msg}</span>
    <span class="sdk-obs-version ${vClass}">v${data.latestVersion}</span>
    <span class="sdk-obs-time">${time}</span>
  `;
  bar.insertBefore(item, bar.firstChild);

  while (bar.children.length > 15) bar.removeChild(bar.lastChild);
}

function showSdkDetail(sdk) {
  selectedSdk = sdk;
  const panel = document.getElementById('sdk-detail-panel');
  const nameEl = document.getElementById('sdk-detail-name');
  const vGrid = document.getElementById('sdk-version-grid');
  const mList = document.getElementById('sdk-methods-list');
  const mCount = document.getElementById('sdk-method-count');
  if (!panel) return;

  nameEl.textContent = `${sdk.name} — ${sdk.description}`;

  const latest = sdk.latestVersion || '—';
  const pinned = sdk.pinnedVersion || '—';
  const vDrift = latest !== '—' && pinned !== latest;
  const major = vDrift && isMajorBump(pinned, latest);
  const statusClass = major ? 'major' : vDrift ? 'drift' : 'ok';
  const checked = sdk.lastCheckedAt ? new Date(sdk.lastCheckedAt).toLocaleString() : 'Never';

  vGrid.innerHTML = `
    <div class="sdk-version-cell">
      <div class="sdk-version-label">Pinned Version</div>
      <div class="sdk-version-value">v${pinned}</div>
    </div>
    <div class="sdk-version-cell">
      <div class="sdk-version-label">Latest Available</div>
      <div class="sdk-version-value ${statusClass}">v${latest}</div>
    </div>
    <div class="sdk-version-cell">
      <div class="sdk-version-label">Registry</div>
      <div class="sdk-version-value">${sdk.registry}</div>
    </div>
    <div class="sdk-version-cell">
      <div class="sdk-version-label">Last Checked</div>
      <div class="sdk-version-value">${checked}</div>
    </div>
    <div class="sdk-version-cell">
      <div class="sdk-version-label">Language</div>
      <div class="sdk-version-value">${sdk.language}</div>
    </div>
    <div class="sdk-version-cell">
      <div class="sdk-version-label">Status</div>
      <div class="sdk-version-value ${statusClass}">${major ? 'Major Drift' : vDrift ? 'Minor Drift' : latest !== '—' ? 'Up to Date' : 'Pending'}</div>
    </div>
  `;

  const methods = sdk.methods || [];
  mCount.textContent = methods.length;
  mList.innerHTML = methods.map(m => `<span class="sdk-method-pill">${m}</span>`).join('');

  // Show release intel section and reset state
  const intelSection = document.getElementById('sdk-intel-section');
  if (intelSection) {
    intelSection.classList.remove('hidden');
    document.getElementById('sdk-intel-loading')?.classList.add('hidden');
    document.getElementById('sdk-intel-summary')?.classList.add('hidden');
    document.getElementById('sdk-intel-usage')?.classList.add('hidden');
    document.getElementById('sdk-intel-findings')?.classList.add('hidden');
    const btn = document.getElementById('btn-analyze-releases');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="scan-search"></i> Analyze Releases';
    }
  }

  panel.classList.remove('hidden');
  refreshIcons();
}

async function analyzeReleases(sdk) {
  const loading = document.getElementById('sdk-intel-loading');
  const summaryEl = document.getElementById('sdk-intel-summary');
  const usageEl = document.getElementById('sdk-intel-usage');
  const findingsEl = document.getElementById('sdk-intel-findings');
  const btn = document.getElementById('btn-analyze-releases');

  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Analyzing...'; refreshIcons(); }
  loading?.classList.remove('hidden');
  summaryEl?.classList.add('hidden');
  usageEl?.classList.add('hidden');
  findingsEl?.classList.add('hidden');

  try {
    const result = await apiService.getSdkReleaseIntel(sdk.id);
    loading?.classList.add('hidden');
    renderIntelSummary(result, summaryEl);
    renderIntelUsage(result.projectUsage, usageEl);
    renderIntelFindings(result.findings, result.sourceUrls, findingsEl);
    showToast(`Release analysis complete — ${result.summary.total} findings`, 'success');
  } catch (err) {
    loading?.classList.add('hidden');
    if (summaryEl) {
      summaryEl.classList.remove('hidden');
      summaryEl.innerHTML = `<div class="intel-error">Analysis failed: ${err.message}</div>`;
    }
    showToast(`Release analysis failed: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="scan-search"></i> Analyze Releases'; refreshIcons(); }
  }
}

function renderIntelSummary(result, el) {
  if (!el) return;
  const s = result.summary;
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="intel-summary-grid">
      <div class="intel-stat">
        <div class="intel-stat-value">${s.total}</div>
        <div class="intel-stat-label">Total Findings</div>
      </div>
      <div class="intel-stat relevant">
        <div class="intel-stat-value">${s.relevant}</div>
        <div class="intel-stat-label">Relevant</div>
      </div>
      <div class="intel-stat breaking">
        <div class="intel-stat-value">${s.breaking}</div>
        <div class="intel-stat-label">Breaking</div>
      </div>
      <div class="intel-stat security">
        <div class="intel-stat-value">${s.security}</div>
        <div class="intel-stat-label">Security</div>
      </div>
      <div class="intel-stat deprecation">
        <div class="intel-stat-value">${s.deprecations}</div>
        <div class="intel-stat-label">Deprecations</div>
      </div>
      <div class="intel-stat feature">
        <div class="intel-stat-value">${s.features}</div>
        <div class="intel-stat-label">Features</div>
      </div>
    </div>
    <div class="intel-analyzed-at">Analyzed ${new Date(result.analyzedAt).toLocaleString()}</div>
  `;
}

function renderIntelUsage(usage, el) {
  if (!el || !usage) return;
  el.classList.remove('hidden');

  const statusClass = usage.installed ? 'installed' : 'not-installed';
  const statusLabel = usage.installed ? 'INSTALLED' : 'NOT INSTALLED';

  el.innerHTML = `
    <h5 class="intel-subsection-title">Project Usage</h5>
    <div class="intel-usage-grid">
      <div class="intel-usage-badge ${statusClass}">${statusLabel}</div>
      ${usage.declaredVersion ? `<span class="intel-usage-pill">Declared: ${usage.declaredVersion}</span>` : ''}
      ${usage.installedVersion ? `<span class="intel-usage-pill">Installed: v${usage.installedVersion}</span>` : ''}
      <span class="intel-usage-pill">${usage.importCount} import${usage.importCount !== 1 ? 's' : ''}</span>
      <span class="intel-usage-pill">${usage.methodUsageCount} method call${usage.methodUsageCount !== 1 ? 's' : ''}</span>
    </div>
    ${usage.files.length > 0 ? `
      <div class="intel-usage-files">
        <span class="intel-files-label">Affected files:</span>
        ${usage.files.map(f => `<code class="intel-file-path">${f}</code>`).join('')}
      </div>
    ` : ''}
  `;
}

function renderIntelFindings(findings, sourceUrls, el) {
  if (!el || !findings) return;
  el.classList.remove('hidden');

  if (findings.length === 0) {
    el.innerHTML = '<p class="intel-empty">No findings — package appears up to date.</p>';
    return;
  }

  const groups = { BREAKING: [], SECURITY: [], DEPRECATION: [], BUGFIX: [], FEATURE: [], COMPATIBILITY: [], PERFORMANCE: [] };
  for (const f of findings) {
    const key = f.impact || 'FEATURE';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }

  const IMPACT_META = {
    BREAKING: { icon: 'alert-triangle', color: 'breaking', label: 'Breaking Changes' },
    SECURITY: { icon: 'shield-alert', color: 'security', label: 'Security' },
    DEPRECATION: { icon: 'clock', color: 'deprecation', label: 'Deprecations' },
    BUGFIX: { icon: 'bug', color: 'bugfix', label: 'Bug Fixes' },
    FEATURE: { icon: 'sparkles', color: 'feature', label: 'New Capabilities' },
    COMPATIBILITY: { icon: 'puzzle', color: 'compat', label: 'Compatibility' },
    PERFORMANCE: { icon: 'zap', color: 'performance', label: 'Performance' }
  };

  const RELEVANCE_BADGE = {
    RELEVANT: { cls: 'rel-relevant', label: 'RELEVANT' },
    POTENTIALLY_RELEVANT: { cls: 'rel-potential', label: 'POTENTIAL' },
    NOT_RELEVANT: { cls: 'rel-not', label: 'NOT RELEVANT' },
    UNKNOWN: { cls: 'rel-unknown', label: 'UNKNOWN' }
  };

  let html = '<h5 class="intel-subsection-title">Findings</h5>';

  for (const [impact, meta] of Object.entries(IMPACT_META)) {
    const items = groups[impact];
    if (!items || items.length === 0) continue;

    html += `
      <div class="intel-group intel-group-${meta.color}">
        <div class="intel-group-header">
          <i data-lucide="${meta.icon}"></i>
          <span>${meta.label}</span>
          <span class="intel-group-count">${items.length}</span>
        </div>
        <div class="intel-group-items">
          ${items.map(f => {
            const rel = RELEVANCE_BADGE[f.relevance] || RELEVANCE_BADGE.UNKNOWN;
            return `
              <div class="intel-finding">
                <div class="intel-finding-top">
                  <span class="intel-relevance-badge ${rel.cls}">${rel.label}</span>
                  <span class="intel-finding-version">v${f.newVersion}</span>
                  ${f.releaseDate ? `<span class="intel-finding-date">${new Date(f.releaseDate).toLocaleDateString()}</span>` : ''}
                </div>
                <div class="intel-finding-summary">${escapeHtml(f.summary)}</div>
                ${f.reason ? `<div class="intel-finding-reason">${escapeHtml(f.reason)}</div>` : ''}
                ${f.affectedFile ? `<div class="intel-finding-file"><code>${f.affectedFile}${f.affectedLine ? ':' + f.affectedLine : ''}</code></div>` : ''}
                ${f.recommendation ? `<div class="intel-finding-rec"><i data-lucide="lightbulb"></i> ${escapeHtml(f.recommendation)}</div>` : ''}
                ${f.migrationSnippet ? `<div class="intel-finding-snippet"><code>${escapeHtml(f.migrationSnippet)}</code></div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  if (sourceUrls) {
    html += '<div class="intel-source-links">';
    if (sourceUrls.releases) html += `<a href="${sourceUrls.releases}" target="_blank" rel="noopener"><i data-lucide="external-link"></i> Releases</a>`;
    if (sourceUrls.changelog) html += `<a href="${sourceUrls.changelog}" target="_blank" rel="noopener"><i data-lucide="file-text"></i> Changelog</a>`;
    if (sourceUrls.homepage) html += `<a href="${sourceUrls.homepage}" target="_blank" rel="noopener"><i data-lucide="home"></i> Homepage</a>`;
    html += '</div>';
  }

  el.innerHTML = html;
  refreshIcons();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attachSdkListeners() {
  document.getElementById('btn-observe-all-sdks')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-observe-all-sdks');
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.classList.add('observing');
    btn.innerHTML = '<i data-lucide="loader"></i> Observing...';
    refreshIcons();

    try {
      const result = await apiService.observeAllSdks();
      sdkData = await apiService.getSdks();
      renderSdkCards();
      showToast(`Observed ${result.observed} SDKs from live registries`, 'success');
    } catch (err) {
      showToast(`SDK observation failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('observing');
      btn.innerHTML = '<i data-lucide="scan"></i> Observe All';
      refreshIcons();
    }
  });

  document.getElementById('sdk-cards-grid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.sdk-card');
    if (!card) return;
    const sdk = sdkData.find(s => s.id === card.dataset.sdkId);
    if (sdk) showSdkDetail(sdk);
  });

  document.getElementById('sdk-detail-close')?.addEventListener('click', () => {
    document.getElementById('sdk-detail-panel')?.classList.add('hidden');
    selectedSdk = null;
  });

  document.getElementById('btn-analyze-releases')?.addEventListener('click', () => {
    if (selectedSdk) analyzeReleases(selectedSdk);
  });
}

function isMajorBump(pinned, latest) {
  const pMajor = parseInt(pinned.split('.')[0], 10);
  const lMajor = parseInt(latest.split('.')[0], 10);
  return !isNaN(pMajor) && !isNaN(lMajor) && lMajor > pMajor;
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}
