const dependencies = new Map();
const baselines = new Map();
const observations = [];
const pipelineRuns = [];
const orders = new Map();
let webhookDriftAlert = null;

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
  },
  {
    id: 'stripe-python',
    name: 'stripe-python',
    type: 'sdk',
    description: 'Stripe Python client library',
    category: 'Billing',
    language: 'Python',
    registry: 'pypi',
    packageName: 'stripe',
    pinnedVersion: '8.4.0',
    currentVersion: null,
    latestVersion: null,
    methods: ['PaymentIntent.create', 'PaymentIntent.confirm', 'PaymentIntent.capture', 'Charge.create', 'Charge.retrieve', 'Customer.create', 'Customer.retrieve', 'Customer.modify', 'Refund.create', 'Refund.retrieve', 'Subscription.create', 'Subscription.modify', 'Invoice.create', 'Invoice.pay'],
    status: 'monitoring',
    lastCheckedAt: null,
    registeredAt: new Date().toISOString()
  },
  {
    id: 'razorpay-node',
    name: 'razorpay-node',
    type: 'sdk',
    description: 'Razorpay Node.js SDK',
    category: 'Payments',
    language: 'JavaScript',
    registry: 'npm',
    packageName: 'razorpay',
    pinnedVersion: '2.9.4',
    currentVersion: null,
    latestVersion: null,
    methods: ['orders.create', 'orders.fetch', 'orders.fetchAll', 'payments.fetch', 'payments.capture', 'payments.refund', 'refunds.create', 'refunds.fetch', 'customers.create', 'customers.fetch', 'settlements.fetchAll', 'settlements.fetch', 'virtualAccounts.create', 'virtualAccounts.fetch', 'virtualAccounts.close', 'qrCode.create', 'qrCode.fetch', 'paymentLink.create', 'paymentLink.fetch', 'paymentLink.cancel', 'subscriptions.create', 'subscriptions.fetch'],
    status: 'monitoring',
    lastCheckedAt: null,
    registeredAt: new Date().toISOString()
  },
  {
    id: 'aws-sdk-go',
    name: 'aws-sdk-go-v2',
    type: 'sdk',
    description: 'AWS SDK for Go',
    category: 'Cloud',
    language: 'Go',
    registry: 'github',
    packageName: 'aws/aws-sdk-go-v2',
    pinnedVersion: '1.30.0',
    currentVersion: null,
    latestVersion: null,
    methods: ['s3.GetObject', 's3.PutObject', 's3.DeleteObject', 'dynamodb.GetItem', 'dynamodb.PutItem', 'dynamodb.Query', 'sqs.SendMessage', 'sqs.ReceiveMessage', 'lambda.Invoke'],
    status: 'monitoring',
    lastCheckedAt: null,
    registeredAt: new Date().toISOString()
  },
  {
    id: 'serde-rs',
    name: 'serde',
    type: 'sdk',
    description: 'Serialization framework for Rust',
    category: 'Serialization',
    language: 'Rust',
    registry: 'crates',
    packageName: 'serde',
    pinnedVersion: '1.0.203',
    currentVersion: null,
    latestVersion: null,
    methods: ['Serialize::serialize', 'Deserialize::deserialize', 'Serializer::serialize_struct', 'Deserializer::deserialize_struct', 'SerializeSeq::serialize_element', 'SerializeMap::serialize_entry'],
    status: 'monitoring',
    lastCheckedAt: null,
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

  removeBaseline(dependencyId) {
    return baselines.delete(dependencyId);
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
  },

  createOrder(orderId, data) {
    const order = { orderId, status: 'created', createdAt: new Date().toISOString(), ...data };
    orders.set(orderId, order);
    return order;
  },

  getOrder(orderId) {
    return orders.get(orderId) || null;
  },

  updateOrder(orderId, updates) {
    const order = orders.get(orderId);
    if (!order) return null;
    Object.assign(order, updates, { updatedAt: new Date().toISOString() });
    return order;
  },

  getOrders() {
    return [...orders.values()];
  },

  setWebhookDriftAlert(alert) {
    webhookDriftAlert = { ...alert, activatedAt: new Date().toISOString() };
    return webhookDriftAlert;
  },

  getWebhookDriftAlert() {
    return webhookDriftAlert;
  },

  clearWebhookDriftAlert() {
    webhookDriftAlert = null;
  }
};
