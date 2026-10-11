const dependencies = new Map();
const baselines = new Map();
const observations = [];
const pipelineRuns = [];

const seed = [
  {
    id: 'stripe-payments',
    name: 'Stripe Payments',
    type: 'api',
    description: 'Payments & billing',
    category: 'Billing',
    baseUrl: 'https://api.stripe.com',
    endpoint: 'POST /v1/payment_intents',
    method: 'POST',
    path: '/v1/payment_intents',
    behaviour: { format: 'JSON', auth: 'Bearer authentication', version: 'v1', rateLimit: '100 requests per minute', pagination: null },
    status: 'monitoring',
    registeredAt: new Date().toISOString()
  },
  {
    id: 'customer-directory',
    name: 'Customer Directory',
    type: 'api',
    description: 'User data & profiles',
    category: 'Users',
    baseUrl: 'http://localhost:4000',
    endpoint: 'GET /api/users',
    method: 'GET',
    path: '/api/users',
    behaviour: { format: 'JSON', auth: 'API key authentication', version: 'v2', rateLimit: null, pagination: 'Page-based' },
    status: 'monitoring',
    registeredAt: new Date().toISOString()
  },
  {
    id: 'product-catalog',
    name: 'Product Catalog',
    type: 'api',
    description: 'Products & inventory',
    category: 'Catalog',
    baseUrl: 'http://localhost:4000',
    endpoint: 'GET /api/products',
    method: 'GET',
    path: '/api/products',
    behaviour: { format: 'JSON', auth: 'no authentication', version: 'v1', rateLimit: null, pagination: 'Page-based' },
    status: 'monitoring',
    registeredAt: new Date().toISOString()
  },
  {
    id: 'order-service',
    name: 'Order Service',
    type: 'api',
    description: 'Orders & fulfilment',
    category: 'Orders',
    baseUrl: 'http://localhost:4000',
    endpoint: 'GET /api/orders',
    method: 'GET',
    path: '/api/orders',
    behaviour: { format: 'JSON', auth: 'Bearer authentication', version: 'v1', rateLimit: null, pagination: 'Cursor-based' },
    status: 'monitoring',
    registeredAt: new Date().toISOString()
  },
  {
    id: 'user-auth-mcp',
    name: 'User Auth MCP',
    type: 'mcp',
    description: 'MCP server for user authentication tools',
    category: 'Auth',
    baseUrl: 'http://localhost:4000',
    endpoint: 'GET /mcp/tools',
    method: 'GET',
    path: '/mcp/tools',
    behaviour: { format: 'JSON', auth: 'no authentication', version: 'MCP/1.0', rateLimit: null, pagination: null },
    status: 'monitoring',
    registeredAt: new Date().toISOString()
  },
  {
    id: 'stripe-webhooks',
    name: 'Stripe Webhooks',
    type: 'webhook',
    description: 'Payment event webhooks',
    category: 'Billing',
    baseUrl: 'http://localhost:4000',
    endpoint: 'GET /webhook/events',
    method: 'GET',
    path: '/webhook/events',
    behaviour: { format: 'JSON', auth: 'no authentication', version: 'v1', rateLimit: null, pagination: null },
    status: 'monitoring',
    registeredAt: new Date().toISOString()
  }
];

seed.forEach(dep => dependencies.set(dep.id, dep));

export const store = {
  getDependencies() {
    return [...dependencies.values()];
  },

  getDependency(id) {
    return dependencies.get(id) || null;
  },

  addDependency(dep) {
    if (dependencies.has(dep.id)) return null;
    dep.registeredAt = dep.registeredAt || new Date().toISOString();
    dep.status = dep.status || 'monitoring';
    dependencies.set(dep.id, dep);
    return dep;
  },

  updateDependency(id, updates) {
    const dep = dependencies.get(id);
    if (!dep) return null;
    Object.assign(dep, updates);
    return dep;
  },

  removeDependency(id) {
    return dependencies.delete(id);
  },

  setBaseline(dependencyId, baseline) {
    baselines.set(dependencyId, {
      ...baseline,
      dependencyId,
      capturedAt: new Date().toISOString()
    });
  },

  getBaseline(dependencyId) {
    return baselines.get(dependencyId) || null;
  },

  getAllBaselines() {
    return [...baselines.values()];
  },

  addObservation(observation) {
    observation.id = observation.id || `obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    observation.timestamp = observation.timestamp || new Date().toISOString();
    observations.push(observation);
    return observation;
  },

  getObservations(dependencyId, limit = 50) {
    const filtered = dependencyId
      ? observations.filter(o => o.dependencyId === dependencyId)
      : observations;
    return filtered.slice(-limit);
  },

  addPipelineRun(run) {
    run.id = run.id || `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    run.startedAt = run.startedAt || new Date().toISOString();
    pipelineRuns.push(run);
    return run;
  },

  getPipelineRun(id) {
    return pipelineRuns.find(r => r.id === id) || null;
  },

  getPipelineRuns(limit = 20) {
    return pipelineRuns.slice(-limit);
  },

  updatePipelineRun(id, updates) {
    const run = pipelineRuns.find(r => r.id === id);
    if (!run) return null;
    Object.assign(run, updates);
    return run;
  }
};
