import { store } from './data/store.js';
import { discoverableCatalog } from './data/mock-data.js';
import { apiService } from './services/api-service.js';
import { refreshIcons } from './utils/icons.js';
import { showToast } from './components/toast.js';
import { renderTable } from './components/table.js';
import { renderTelemetryFeed } from './components/telemetry.js';
import { updateMetrics } from './components/metrics.js';
import { startPipeline, abortPipeline, isPipelineActive, isPipelineModalOpen } from './components/pipeline.js';
import { openInspectModal, closeInspectModal } from './components/inspect.js';
import { openApiDrawer, closeApiDrawer, handleDrawerPing } from './components/drawer.js';
import { renderCatalog, openBrowseModal, closeBrowseModal, openAddApiModal, closeAddApiModal } from './components/catalog.js';

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  renderAll();
  setupStoreSubscriptions();
  attachEventListeners();
  initHeroGraph();
  refreshIcons();

  await connectBackend();
});

async function connectBackend() {
  const online = await apiService.checkBackend();
  if (online) {
    try {
      const deps = await apiService.getDependencies();
      store.loadFromBackend(deps);
      showToast('Connected to Rebase backend', 'success');

      // Capture baselines for simulator-connected dependencies on first connect
      for (const dep of deps) {
        if (dep.baseUrl && dep.baseUrl.includes('localhost:4000')) {
          try {
            await apiService.runPipeline(dep.id);
          } catch {}
        }
      }
      // Reload deps after baseline runs (status may have updated)
      const refreshed = await apiService.getDependencies();
      store.loadFromBackend(refreshed);
    } catch (err) {
      console.warn('Backend fetch failed:', err);
    }
  } else {
    store.setBackendConnected(false);
    console.info('Backend offline — using mock data');
  }
}

function renderAll() {
  doRenderTable();
  doRenderTelemetry();
  doRenderMetrics();
  doRenderCatalog();
}

// ============================================================
// STORE SUBSCRIPTIONS — auto re-render on state changes
// ============================================================
function setupStoreSubscriptions() {
  store.subscribe('dependencies', () => {
    doRenderTable();
    doRenderMetrics();
  });

  store.subscribe('telemetryEvents', () => {
    doRenderTelemetry();
  });

  store.subscribe('metrics', () => {
    doRenderMetrics();
  });

  store.subscribe('ui', () => {
    doRenderTable();
  });
}

// ============================================================
// RENDER BRIDGES — pass store data + callbacks to components
// ============================================================
function doRenderTable() {
  const deps = store.getDependencies();
  const ui = store.getUI();
  renderTable(deps, ui.currentFilter, ui.currentSearchQuery, {
    onRowClick: (api) => openApiDrawer(api, { onPing: handleDrawerPing }),
    onInspect: () => triggerInspect(),
    onCopyUrl: (url) => {
      navigator.clipboard.writeText(url).then(() => {
        showToast(`Copied to clipboard: ${url}`, 'success');
      });
    }
  });
}

function doRenderTelemetry() {
  renderTelemetryFeed(store.getTelemetryEvents(), {
    onEventAction: () => triggerInspect()
  });
}

function doRenderMetrics() {
  const metrics = store.getMetrics();
  updateMetrics(metrics, store.getDependencies().length);
}

function doRenderCatalog() {
  renderCatalog(discoverableCatalog, {
    onAdd: (service) => {
      if (store.getDependencies().some(a => a.name === service.name)) {
        showToast(`${service.name} is already registered!`, 'info');
        return;
      }
      store.addDependency({
        id: service.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: service.name,
        description: service.description,
        category: 'Third-Party',
        baseUrl: service.baseUrl,
        endpoint: service.endpoint,
        method: service.method,
        path: service.endpoint.split(' ')[1] || service.endpoint,
        behaviour: {
          format: 'JSON',
          auth: service.auth,
          version: service.version,
          rateLimit: service.rateLimit,
          pagination: null
        },
        status: 'Monitoring',
        iconType: 'custom',
        latencyP95: '38ms',
        uptime: '99.98%',
        lastObserved: 'Just now',
        samplePayload: `{\n  "service": "${service.name}",\n  "status": "active"\n}`
      });
      closeBrowseModal();
      showToast(`Registered dependency: ${service.name} into radar`, 'success');
    }
  });
}

function triggerInspect() {
  openInspectModal(null, {
    onRemediate: (obs) => {
      store.updateDependency(obs.serviceId, (dep) => {
        dep.status = 'Monitoring';
        dep.behaviour.version = 'v2 (Remediated)';
      });

      store.setMetrics({ changesDetected: Math.max(0, store.getMetrics().changesDetected - 1) });

      const notifItem = document.getElementById('notif-customer-dir');
      if (notifItem) notifItem.classList.remove('unread');

      showToast('TypeScript contracts updated & SDK regenerated successfully!', 'success');
    }
  });
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function attachEventListeners() {
  const searchInput = document.getElementById('api-search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      store.setSearchQuery(query);
      if (searchClearBtn) searchClearBtn.classList.toggle('hidden', query.length === 0);
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      store.setSearchQuery('');
      searchClearBtn.classList.add('hidden');
      if (searchInput) searchInput.focus();
    });
  }

  const btnResetSearch = document.getElementById('btn-reset-search');
  if (btnResetSearch) {
    btnResetSearch.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (searchClearBtn) searchClearBtn.classList.add('hidden');
      store.setSearchQuery('');
      store.setFilter('all');
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
    });
  }

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      store.setFilter(chip.dataset.filter);
    });
  });

  // Inspect triggers
  const btnInspectSummary = document.getElementById('btn-inspect-summary');
  if (btnInspectSummary) btnInspectSummary.addEventListener('click', () => triggerInspect());

  const notifInspectBtn = document.getElementById('notif-inspect-btn');
  if (notifInspectBtn) {
    notifInspectBtn.addEventListener('click', () => {
      const popover = document.getElementById('notifications-popover');
      if (popover) popover.classList.add('hidden');
      triggerInspect();
    });
  }

  const modalCloseInspect = document.getElementById('modal-close-inspect');
  if (modalCloseInspect) modalCloseInspect.addEventListener('click', closeInspectModal);

  // Hero buttons
  const btnHeroBrowse = document.getElementById('btn-hero-browse');
  if (btnHeroBrowse) btnHeroBrowse.addEventListener('click', openBrowseModal);

  const btnHeroAdd = document.getElementById('btn-hero-add');
  if (btnHeroAdd) btnHeroAdd.addEventListener('click', openAddApiModal);

  // Browse Services modal
  const btnBrowseServices = document.getElementById('btn-browse-services');
  if (btnBrowseServices) btnBrowseServices.addEventListener('click', openBrowseModal);
  const modalCloseBrowse = document.getElementById('modal-close-browse');
  if (modalCloseBrowse) modalCloseBrowse.addEventListener('click', closeBrowseModal);
  const btnCloseBrowseFooter = document.getElementById('btn-close-browse-footer');
  if (btnCloseBrowseFooter) btnCloseBrowseFooter.addEventListener('click', closeBrowseModal);

  // Add API modal
  const btnAddApi = document.getElementById('btn-add-api');
  if (btnAddApi) btnAddApi.addEventListener('click', openAddApiModal);
  const btnAddApiTop = document.getElementById('btn-add-api-top');
  if (btnAddApiTop) btnAddApiTop.addEventListener('click', openAddApiModal);
  const modalCloseAdd = document.getElementById('modal-close-add');
  if (modalCloseAdd) modalCloseAdd.addEventListener('click', closeAddApiModal);
  const btnCancelAdd = document.getElementById('btn-cancel-add');
  if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeAddApiModal);

  // Add API form submission
  const formAddApi = document.getElementById('form-add-api');
  if (formAddApi) {
    formAddApi.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('add-service-name').value;
      const desc = document.getElementById('add-service-desc').value;
      const baseUrl = document.getElementById('add-base-url').value;
      const endpoint = document.getElementById('add-endpoint').value;
      const authType = document.getElementById('add-auth-type').value;
      const version = document.getElementById('add-version').value;
      const rateLimit = document.getElementById('add-rate-limit').value;
      const status = document.getElementById('add-status').value;

      const parts = endpoint.split(' ');
      const method = parts.length > 1 ? parts[0].toUpperCase() : 'GET';
      const path = parts.length > 1 ? parts[1] : endpoint;

      store.addDependency({
        id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name,
        description: desc,
        category: 'Custom',
        baseUrl,
        endpoint,
        method,
        path,
        behaviour: {
          format: 'JSON',
          auth: authType,
          version: version || 'v1',
          rateLimit: rateLimit || '300 req/min',
          pagination: null
        },
        status,
        iconType: 'custom',
        latencyP95: '45ms',
        uptime: '100.0%',
        lastObserved: 'Just registered',
        samplePayload: `{\n  "service": "${name}",\n  "status": "ready"\n}`
      });

      closeAddApiModal();
      showToast(`Successfully registered ${name}!`, 'success');
    });
  }

  // Drawer
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeApiDrawer);
  const btnDrawerCloseAction = document.getElementById('btn-drawer-close-action');
  if (btnDrawerCloseAction) btnDrawerCloseAction.addEventListener('click', closeApiDrawer);
  const btnDrawerPing = document.getElementById('btn-drawer-ping');
  if (btnDrawerPing) btnDrawerPing.addEventListener('click', () => handleDrawerPing(showToast));

  // Notifications popover
  const btnNotifications = document.getElementById('btn-notifications');
  const notificationsPopover = document.getElementById('notifications-popover');
  if (btnNotifications && notificationsPopover) {
    btnNotifications.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationsPopover.classList.toggle('hidden');
      const profileMenu = document.getElementById('profile-menu');
      if (profileMenu) profileMenu.classList.add('hidden');
    });
  }

  // Profile menu
  const userProfileToggle = document.getElementById('user-profile-toggle');
  const profileMenu = document.getElementById('profile-menu');
  if (userProfileToggle && profileMenu) {
    userProfileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
      if (notificationsPopover) notificationsPopover.classList.add('hidden');
    });
  }

  // Click outside to dismiss popovers
  document.addEventListener('click', (e) => {
    if (notificationsPopover && btnNotifications && !notificationsPopover.contains(e.target) && !btnNotifications.contains(e.target)) {
      notificationsPopover.classList.add('hidden');
    }
    if (profileMenu && userProfileToggle && !profileMenu.contains(e.target) && !userProfileToggle.contains(e.target)) {
      profileMenu.classList.add('hidden');
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
    if (e.key === 'Escape') {
      closeInspectModal();
      closeBrowseModal();
      closeAddApiModal();
      closeApiDrawer();
      if (notificationsPopover) notificationsPopover.classList.add('hidden');
      if (profileMenu) profileMenu.classList.add('hidden');
      if (isPipelineModalOpen()) abortPipeline();
    }
  });

  const btnQuickSearch = document.getElementById('btn-quick-search');
  if (btnQuickSearch) btnQuickSearch.addEventListener('click', () => { if (searchInput) searchInput.focus(); });

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('sidebar-collapsed'));
  }

  // Sidebar navigation
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      if (view === 'breakers') {
        triggerInspect();
      } else {
        switchView(view);
      }
    });
  });

  // Simulation control panel — wired to real backend when available
  document.querySelectorAll('.sim-btn[data-scenario]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isPipelineActive() || isPipelineModalOpen()) return;
      const useBackend = store.isBackendConnected();
      startPipeline(btn.dataset.scenario, {
        useBackend,
        onComplete: useBackend ? handleBackendPipelineComplete : handleMockPipelineComplete
      });
    });
  });

  const simResetBtn = document.getElementById('sim-reset');
  if (simResetBtn) {
    simResetBtn.addEventListener('click', async () => {
      if (store.isBackendConnected()) {
        try {
          await apiService.simulatorReset();
          const deps = await apiService.getDependencies();
          store.loadFromBackend(deps);
          // Re-capture baselines after reset
          for (const dep of deps) {
            if (dep.baseUrl && dep.baseUrl.includes('localhost:4000')) {
              try { await apiService.runPipeline(dep.id); } catch {}
            }
          }
          const refreshed = await apiService.getDependencies();
          store.loadFromBackend(refreshed);
          showToast('Simulator reset — baselines recaptured', 'success');
        } catch (err) {
          showToast(`Reset failed: ${err.message}`, 'error');
        }
      } else {
        store.resetToBaseline();
        showToast('Simulations reset — dashboard restored to baseline', 'info');
      }
    });
  }

  // Pipeline modal close
  const pipelineCloseBtn = document.getElementById('modal-close-pipeline');
  if (pipelineCloseBtn) pipelineCloseBtn.addEventListener('click', abortPipeline);

  const pipelineModal = document.getElementById('modal-pipeline');
  if (pipelineModal) {
    pipelineModal.addEventListener('click', (e) => {
      if (e.target === pipelineModal) abortPipeline();
    });
  }
}

// ============================================================
// PIPELINE COMPLETION HANDLERS
// ============================================================
async function handleBackendPipelineComplete(run, scenarioId) {
  const safety = run.stageResults?.safety;
  const semantic = run.stageResults?.semantic;
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);

  const sourceMap = {
    'api-rename': 'Customer Directory',
    'mcp-danger': 'User Auth MCP',
    'webhook-rename': 'Stripe Webhooks'
  };
  const source = sourceMap[scenarioId] || run.dependencyName;

  if (safety?.decision === 'auto-apply') {
    store.addTelemetryEvent({
      id: 'run-' + Date.now(),
      time,
      type: 'ok',
      source,
      message: `Adapter auto-applied — ${semantic?.classification || 'change resolved'}`,
      badge: 'AUTO-FIX',
      actionable: false,
      simulated: true
    });
    showToast(`${source} — auto-fix applied successfully`, 'success');
  } else if (safety?.decision === 'blocked') {
    store.addTelemetryEvent({
      id: 'run-' + Date.now(),
      time,
      type: 'warn',
      source,
      message: `BLOCKED — ${safety.reason}`,
      badge: 'BLOCKED',
      actionable: true,
      simulated: true
    });
    showToast(`${source} — auto-fix BLOCKED for safety`, 'info');
  } else {
    store.addTelemetryEvent({
      id: 'run-' + Date.now(),
      time,
      type: 'info',
      source,
      message: `Human review required — ${safety?.reason || 'confidence below threshold'}`,
      badge: 'REVIEW',
      actionable: true,
      simulated: true
    });
    showToast(`${source} — flagged for human review`, 'info');
  }

  // Refresh dependency status from backend
  try {
    const deps = await apiService.getDependencies();
    store.loadFromBackend(deps);
  } catch {}

  store.addPipelineRun(run);
}

function handleMockPipelineComplete(scenario, scenarioId) {
  const outcome = scenario.steps.decision.outcome;
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  const source = scenario.subtitle.split(' — ')[0];

  if (outcome === 'auto-fix') {
    store.addTelemetryEvent({
      id: 'sim-' + Date.now(),
      time,
      type: 'ok',
      source,
      message: `Adapter deployed — ${scenario.title.replace(' Detected', '')} resolved automatically`,
      badge: 'FIXED',
      actionable: false,
      simulated: true
    });
    showToast(`${scenario.title.replace(' Detected', '')} — auto-fix applied successfully`, 'success');
  } else {
    store.addTelemetryEvent({
      id: 'sim-' + Date.now(),
      time,
      type: 'warn',
      source,
      message: `BLOCKED — Semantic danger detected. Human review required.`,
      badge: 'BLOCKED',
      actionable: false,
      simulated: true
    });
    showToast(`${scenario.title.replace(' Detected', '')} — auto-fix BLOCKED for safety`, 'info');
  }
}

// ============================================================
// VIEW SWITCHING
// ============================================================
function switchView(viewId) {
  const viewMap = {
    'apis': 'view-apis',
    'overview': 'view-apis',
    'sdks': 'view-sdks',
    'mcp': 'view-mcp',
    'settings': 'view-settings'
  };
  const targetId = viewMap[viewId] || 'view-apis';
  const views = ['view-apis', 'view-sdks', 'view-mcp', 'view-settings'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== targetId);
  });

  const breadcrumb = document.querySelector('.breadcrumb-current');
  if (breadcrumb) {
    const labels = { 'view-apis': 'APIs', 'view-sdks': 'SDKs', 'view-mcp': 'MCP Servers', 'view-settings': 'Settings' };
    breadcrumb.textContent = labels[targetId] || 'APIs';
  }
}

// ============================================================
// HERO DEPENDENCY GRAPH — Interactive tooltips
// ============================================================
function initHeroGraph() {
  const container = document.getElementById('hero-dep-graph');
  const tooltip = document.getElementById('graph-tooltip');
  const svg = document.getElementById('dep-graph-svg');
  if (!container || !tooltip || !svg) return;

  const nodes = svg.querySelectorAll('.graph-node[data-tooltip]');
  nodes.forEach(node => {
    node.addEventListener('mouseenter', () => {
      const text = node.getAttribute('data-tooltip');
      tooltip.textContent = text;
      tooltip.classList.add('visible');

      const circle = node.querySelector('circle');
      const ctm = circle.getCTM();
      const containerRect = container.getBoundingClientRect();

      const cx = parseFloat(circle.getAttribute('cx'));
      const cy = parseFloat(circle.getAttribute('cy'));
      const pt = svg.createSVGPoint();
      pt.x = cx;
      pt.y = cy;
      const screenPt = pt.matrixTransform(ctm);

      tooltip.style.left = (screenPt.x - containerRect.left) + 'px';
      tooltip.style.top = (screenPt.y - containerRect.top - 44) + 'px';
      tooltip.style.transform = 'translate(-50%, 0)';
    });

    node.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });

    node.addEventListener('click', () => {
      if (node.getAttribute('data-status') === 'warn') {
        triggerInspect();
      }
    });
  });
}
