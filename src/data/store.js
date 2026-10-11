import { initialApiDependencies, initialTelemetryEvents, initialMetrics } from './mock-data.js';

const state = {
  dependencies: JSON.parse(JSON.stringify(initialApiDependencies)),
  telemetryEvents: [...initialTelemetryEvents],
  metrics: { ...initialMetrics },
  pipelineRuns: [],
  backendConnected: false,
  ui: {
    currentFilter: 'all',
    currentSearchQuery: ''
  }
};

let baselineDependencies = JSON.parse(JSON.stringify(initialApiDependencies));
const listeners = new Map();

function notify(key) {
  if (listeners.has(key)) {
    listeners.get(key).forEach(cb => cb(state[key]));
  }
}

function mapBackendDep(dep) {
  const iconMap = {
    'stripe-payments': { iconType: 'stripe', latencyP95: '64ms', uptime: '99.99%' },
    'customer-directory': { iconType: 'users', latencyP95: '42ms', uptime: '99.95%' },
    'product-catalog': { iconType: 'package', latencyP95: '28ms', uptime: '100.0%' },
    'order-service': { iconType: 'shopping-bag', latencyP95: '55ms', uptime: '99.89%' },
    'user-auth-mcp': { iconType: 'shield', latencyP95: '15ms', uptime: '100.0%' },
    'stripe-webhooks': { iconType: 'webhook', latencyP95: '22ms', uptime: '99.98%' }
  };

  const defaults = iconMap[dep.id] || { iconType: 'custom', latencyP95: '45ms', uptime: '100.0%' };

  const statusMap = {
    'monitoring': 'Monitoring',
    'change-detected': 'Change detected',
    'auto-applied': 'Auto-applied',
    'blocked': 'Blocked',
    'pending-review': 'Review required'
  };

  return {
    ...dep,
    status: statusMap[dep.status] || dep.status,
    iconType: defaults.iconType,
    latencyP95: dep.lastLatencyMs ? `${dep.lastLatencyMs}ms` : defaults.latencyP95,
    uptime: defaults.uptime,
    lastObserved: dep.lastObservedAt ? formatTimeAgo(dep.lastObservedAt) : 'Never',
    samplePayload: dep.samplePayload || `{\n  "service": "${dep.name}",\n  "status": "ready"\n}`
  };
}

function formatTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 5000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)} seconds ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minute(s) ago`;
  return `${Math.floor(diff / 3600000)} hour(s) ago`;
}

export const store = {
  getState() {
    return state;
  },

  getDependencies() {
    return state.dependencies;
  },

  getDependency(id) {
    return state.dependencies.find(d => d.id === id);
  },

  getMetrics() {
    return state.metrics;
  },

  getTelemetryEvents() {
    return state.telemetryEvents;
  },

  getPipelineRuns() {
    return state.pipelineRuns;
  },

  getUI() {
    return state.ui;
  },

  isBackendConnected() {
    return state.backendConnected;
  },

  setBackendConnected(connected) {
    state.backendConnected = connected;
  },

  setDependencies(deps) {
    state.dependencies = deps;
    notify('dependencies');
  },

  loadFromBackend(backendDeps) {
    state.dependencies = backendDeps.map(mapBackendDep);
    baselineDependencies = JSON.parse(JSON.stringify(state.dependencies));

    const changes = state.dependencies.filter(d =>
      d.status === 'Change detected' || d.status === 'Blocked' || d.status === 'Review required'
    ).length;
    state.metrics.registeredApis = state.dependencies.length;
    state.metrics.changesDetected = changes;

    state.backendConnected = true;
    notify('dependencies');
    notify('metrics');
  },

  updateDependency(id, updater) {
    const dep = state.dependencies.find(d => d.id === id);
    if (dep) {
      if (typeof updater === 'function') {
        updater(dep);
      } else {
        Object.assign(dep, updater);
      }
      notify('dependencies');
    }
  },

  updateDependencyFromBackend(backendDep) {
    const mapped = mapBackendDep(backendDep);
    const idx = state.dependencies.findIndex(d => d.id === mapped.id);
    if (idx >= 0) {
      state.dependencies[idx] = { ...state.dependencies[idx], ...mapped };
    }
    const changes = state.dependencies.filter(d =>
      d.status === 'Change detected' || d.status === 'Blocked' || d.status === 'Review required'
    ).length;
    state.metrics.changesDetected = changes;
    notify('dependencies');
    notify('metrics');
  },

  addDependency(dep) {
    state.dependencies.unshift(dep);
    state.metrics.registeredApis = state.dependencies.length;
    notify('dependencies');
    notify('metrics');
  },

  setMetrics(updates) {
    Object.assign(state.metrics, updates);
    notify('metrics');
  },

  addTelemetryEvent(event) {
    state.telemetryEvents.unshift(event);
    if (state.telemetryEvents.length > 50) state.telemetryEvents.length = 50;
    notify('telemetryEvents');
  },

  addPipelineRun(run) {
    state.pipelineRuns.unshift(run);
    notify('pipelineRuns');
  },

  setFilter(filter) {
    state.ui.currentFilter = filter;
    notify('ui');
  },

  setSearchQuery(query) {
    state.ui.currentSearchQuery = query;
    notify('ui');
  },

  resetToBaseline() {
    state.dependencies = JSON.parse(JSON.stringify(baselineDependencies));
    state.telemetryEvents = state.telemetryEvents.filter(e => !e.simulated);
    state.metrics = {
      registeredApis: state.dependencies.length,
      changesDetected: 0,
      workflowsProtected: 8
    };
    notify('dependencies');
    notify('telemetryEvents');
    notify('metrics');
  },

  subscribe(key, callback) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(callback);
    return () => listeners.get(key).delete(callback);
  }
};
