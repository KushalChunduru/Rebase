// ============================================================
// MOCK DATA — Extracted from main.js for data-layer separation
// Phase 14 will replace this with real backend data
// ============================================================

export const initialApiDependencies = [
  {
    id: 'stripe-payments',
    name: 'Stripe Payments',
    description: 'Payments & billing',
    category: 'Billing',
    baseUrl: 'https://api.stripe.com',
    endpoint: 'POST /v1/payment_intents',
    method: 'POST',
    path: '/v1/payment_intents',
    behaviour: {
      format: 'JSON',
      auth: 'Bearer authentication',
      version: 'v1',
      rateLimit: '100 requests per minute',
      pagination: null
    },
    status: 'Monitoring',
    iconType: 'stripe',
    latencyP95: '64ms',
    uptime: '99.99%',
    lastObserved: '4 seconds ago',
    samplePayload: `{
  "amount": 2000,
  "currency": "usd",
  "automatic_payment_methods": {
    "enabled": true
  }
}`
  },
  {
    id: 'customer-directory',
    name: 'Customer Directory',
    description: 'User data & profiles',
    category: 'Users',
    baseUrl: 'https://api.afterform.dev/users',
    endpoint: 'GET /users',
    method: 'GET',
    path: '/users',
    behaviour: {
      format: 'JSON',
      auth: 'API key authentication',
      version: 'v2',
      rateLimit: null,
      pagination: 'Page-based'
    },
    status: 'Change detected',
    iconType: 'users',
    latencyP95: '42ms',
    uptime: '99.95%',
    lastObserved: '3 minutes ago',
    samplePayload: `{
  "page": 1,
  "limit": 50,
  "status": "active"
}`
  },
  {
    id: 'product-catalog',
    name: 'Product Catalog',
    description: 'Products & inventory',
    category: 'Catalog',
    baseUrl: 'https://api.afterform.dev/products',
    endpoint: 'GET /products',
    method: 'GET',
    path: '/products',
    behaviour: {
      format: 'JSON',
      auth: 'no authentication',
      version: 'v1',
      rateLimit: null,
      pagination: 'Page-based'
    },
    status: 'Monitoring',
    iconType: 'package',
    latencyP95: '28ms',
    uptime: '100.0%',
    lastObserved: '12 seconds ago',
    samplePayload: `{
  "in_stock": true,
  "department": "apparel"
}`
  },
  {
    id: 'order-service',
    name: 'Order Service',
    description: 'Orders & fulfilment',
    category: 'Orders',
    baseUrl: 'https://api.afterform.dev/orders',
    endpoint: 'GET /orders',
    method: 'GET',
    path: '/orders',
    behaviour: {
      format: 'JSON',
      auth: 'Bearer authentication',
      version: 'v1',
      rateLimit: null,
      pagination: 'Cursor-based'
    },
    status: 'Review required',
    iconType: 'shopping-bag',
    latencyP95: '55ms',
    uptime: '99.89%',
    lastObserved: '1 minute ago',
    samplePayload: `{
  "cursor": "ord_cur_8921a",
  "limit": 25
}`
  }
];

export const discoverableCatalog = [
  {
    name: 'OpenAI Intelligence',
    description: 'GPT-4o & embeddings inference',
    baseUrl: 'https://api.openai.com/v1',
    endpoint: 'POST /chat/completions',
    method: 'POST',
    auth: 'Bearer authentication',
    version: 'v1',
    rateLimit: '500 requests per minute',
    icon: 'cpu',
    iconBg: '#10a37f'
  },
  {
    name: 'Twilio Communications',
    description: 'Programmable SMS & voice dispatch',
    baseUrl: 'https://api.twilio.com/2010-04-01',
    endpoint: 'POST /Accounts/{Sid}/Messages.json',
    method: 'POST',
    auth: 'Bearer authentication',
    version: 'v2010',
    rateLimit: '200 requests per minute',
    icon: 'message-square',
    iconBg: '#f22f46'
  },
  {
    name: 'GitHub Octokit API',
    description: 'Source control & webhook pipelines',
    baseUrl: 'https://api.github.com',
    endpoint: 'GET /repos/{owner}/{repo}/pulls',
    method: 'GET',
    auth: 'Bearer authentication',
    version: 'v3',
    rateLimit: '5000 requests per hour',
    icon: 'git-pull-request',
    iconBg: '#24292f'
  },
  {
    name: 'Supabase Data Gateway',
    description: 'PostgREST realtime database relay',
    baseUrl: 'https://xyz.supabase.co/rest/v1',
    endpoint: 'GET /rpc/telemetry_sync',
    method: 'GET',
    auth: 'API key authentication',
    version: 'v1',
    rateLimit: '1000 requests per minute',
    icon: 'database',
    iconBg: '#3ecf8e'
  }
];

export const SIMULATION_SCENARIOS = {
  'api-rename': {
    title: 'API Field Rename Detected',
    subtitle: 'Customer Directory API — GET /users',
    iconClass: 'bg-lime',
    headerIcon: 'arrow-right-left',
    steps: {
      detecting: {
        oldSchema: `{
  "id": "usr_99812",
  "name": "Sarah Connor",
  "email": "sarah@cyberdyne.io",
  "status": "active",
  "created_at": 1726789000
}`,
        newSchema: `{
  "id": "usr_99812",
  "display_name": "Sarah Connor",
  "email": "sarah@cyberdyne.io",
  "status": "active",
  "created_at": 1726789000
}`,
        diffSummary: 'Field removed: "name" — Field added: "display_name"',
        highlightOld: '"name"',
        highlightNew: '"display_name"'
      },
      analyzing: {
        schemaCompat: 85,
        semanticCompat: 95,
        risk: 'LOW',
        riskClass: 'safe',
        classification: 'Semantic equivalent detected — "name" and "display_name" refer to the same user identity field. Adapter bridge recommended.',
        confidence: 94
      },
      repairing: {
        adapterCode: `<span class="code-comment">// Auto-generated adapter — Customer Directory API</span>
<span class="code-keyword">function</span> <span class="code-fn">adaptUserResponse</span>(response) {
  <span class="code-keyword">if</span> (response.display_name && !response.name) {
    response.name = response.display_name;
  }
  <span class="code-keyword">return</span> response;
}

<span class="code-comment">// Applied to: checkout pipeline, profile sync</span>
module.exports = { <span class="code-fn">adaptUserResponse</span> };`
      },
      testing: {
        results: [
          { test: 'Field mapping: display_name → name', pass: true },
          { test: 'Checkout pipeline integration', pass: true },
          { test: 'User profile sync daemon', pass: true },
          { test: 'Response schema validation', pass: true }
        ]
      },
      decision: {
        outcome: 'auto-fix',
        message: 'AUTO-FIX APPLIED',
        detail: 'Compatibility adapter deployed. Zero downtime. All 4 regression tests passing. Downstream workflows protected.'
      }
    }
  },
  'mcp-danger': {
    title: 'MCP Semantic Danger Detected',
    subtitle: 'User Auth MCP Server — delete_user tool',
    iconClass: 'bg-red',
    headerIcon: 'shield-alert',
    steps: {
      detecting: {
        oldSchema: `{
  "tool": "delete_user",
  "description": "Deactivate user account",
  "params": {
    "user_id": { "type": "integer", "required": true }
  },
  "returns": { "success": "boolean" }
}`,
        newSchema: `{
  "tool": "delete_user",
  "description": "Permanently delete user and all associated data",
  "params": {
    "user_id": { "type": "integer", "required": true }
  },
  "returns": { "success": "boolean" }
}`,
        diffSummary: 'Description changed: "Deactivate user account" → "Permanently delete user and all associated data"',
        highlightOld: '"Deactivate user account"',
        highlightNew: '"Permanently delete user and all associated data"'
      },
      analyzing: {
        schemaCompat: 100,
        semanticCompat: 12,
        risk: 'CRITICAL',
        riskClass: 'danger',
        classification: 'DESTRUCTIVE SEMANTIC CHANGE — Tool schema is identical but operational meaning has fundamentally changed. "Deactivate" (reversible) → "Permanently delete" (irreversible). Auto-repair MUST be blocked.',
        confidence: 98
      },
      repairing: null,
      testing: null,
      decision: {
        outcome: 'blocked',
        message: 'AUTO-FIX BLOCKED',
        detail: 'Human review required. Schema compatibility is 100% but semantic analysis reveals a destructive operational change. Applying this silently would cause irreversible data loss.'
      }
    }
  },
  'webhook-rename': {
    title: 'Webhook Event Rename Detected',
    subtitle: 'Stripe Payments — Webhook Receiver',
    iconClass: 'bg-purple',
    headerIcon: 'webhook',
    steps: {
      detecting: {
        oldSchema: `{
  "event": "payment_success",
  "payload": {
    "payment_id": "pay_8xK2m",
    "amount": 4999,
    "currency": "usd"
  }
}`,
        newSchema: `{
  "event": "payment.completed",
  "payload": {
    "transaction_id": "txn_8xK2m",
    "amount": 4999,
    "currency": "usd"
  }
}`,
        diffSummary: 'Event renamed: "payment_success" → "payment.completed" — Field renamed: "payment_id" → "transaction_id"',
        highlightOld: '"payment_success"',
        highlightNew: '"payment.completed"'
      },
      analyzing: {
        schemaCompat: 70,
        semanticCompat: 92,
        risk: 'MODERATE',
        riskClass: 'moderate',
        classification: 'Event naming convention migration detected (underscore → dot notation). Payload field "payment_id" renamed to "transaction_id" — semantic equivalent confirmed.',
        confidence: 91
      },
      repairing: {
        adapterCode: `<span class="code-comment">// Auto-generated adapter — Stripe Webhook</span>
<span class="code-keyword">function</span> <span class="code-fn">adaptWebhookEvent</span>(event) {
  <span class="code-comment">// Event name mapping</span>
  <span class="code-keyword">if</span> (event.event === <span class="code-string">"payment.completed"</span>) {
    event.event = <span class="code-string">"payment_success"</span>;
  }
  <span class="code-comment">// Payload field mapping</span>
  <span class="code-keyword">if</span> (event.payload?.transaction_id) {
    event.payload.payment_id = event.payload.transaction_id;
  }
  <span class="code-keyword">return</span> event;
}

module.exports = { <span class="code-fn">adaptWebhookEvent</span> };`
      },
      testing: {
        results: [
          { test: 'Event mapping: payment.completed → payment_success', pass: true },
          { test: 'Payload field: transaction_id → payment_id', pass: true },
          { test: 'Checkout webhook handler', pass: true }
        ]
      },
      decision: {
        outcome: 'auto-fix',
        message: 'AUTO-FIX APPLIED',
        detail: 'Event and payload adapters deployed. All 3 regression tests passing. Webhook processing pipeline intact.'
      }
    }
  }
};

export const STEP_ORDER = ['detecting', 'analyzing', 'repairing', 'testing', 'decision'];
export const STEP_LABELS = ['DETECT', 'ANALYZE', 'REPAIR', 'TEST', 'DECIDE'];
export const STEP_ICONS = ['scan-search', 'brain', 'wrench', 'test-tubes', 'shield-check'];

export const initialTelemetryEvents = [
  {
    id: 't1',
    time: '12:04:31',
    type: 'ok',
    source: 'Stripe API',
    message: 'Response contracts validated across 14 payment workers',
    badge: '200 OK',
    actionable: false
  },
  {
    id: 't2',
    time: '12:04:28',
    type: 'warn',
    source: 'Customer Directory',
    message: 'Breaking field: <code>user_tier</code> now required in v2 payload',
    badge: 'DRIFT',
    actionable: true
  },
  {
    id: 't3',
    time: '12:04:12',
    type: 'ok',
    source: 'Product Catalog',
    message: 'Schema snapshot matched — 0 field deviations',
    badge: 'VALID',
    actionable: false
  },
  {
    id: 't4',
    time: '12:03:58',
    type: 'info',
    source: 'Order Service',
    message: 'Cursor pagination token format changed on <code>/orders</code>',
    badge: 'REVIEW',
    actionable: false
  }
];

export const defaultInspectObservation = {
  serviceId: 'customer-directory',
  serviceName: 'Customer Directory API',
  serviceIcon: 'users',
  serviceIconBg: 'bg-purple',
  serviceUrl: 'https://api.afterform.dev/users',
  serviceEndpoint: 'GET /users',
  severity: 'BREAKING CONTRACT',
  baselineVersion: 'v1.8.4',
  baselineStatusLabel: 'Passing Contracts',
  baselineStatusClass: 'tag-green',
  currentVersion: 'v2.0.0-rc1',
  currentStatusLabel: 'Breaking Changes Detected',
  currentStatusClass: 'tag-orange',
  baselineSchemaHtml: `{
  "id": "usr_99812",
  "name": "Sarah Connor",
  "email": "sarah@cyberdyne.io",
  <span class="diff-line-removed">- "billing_address": {
-   "street": "104 Sky Net Blvd",
-   "country": "US"
- },</span>
  "status": "active",
  "created_at": 1726789000
}`,
  currentSchemaHtml: `{
  "id": "usr_99812",
  "name": "Sarah Connor",
  "email": "sarah@cyberdyne.io",
  <span class="diff-line-added">+ "tax_identifier": {
+   "tin": "US-991204-B",
+   "verified": true
+ }, // MANDATORY FIELD</span>
  <span class="diff-line-added">+ "user_tier": "enterprise", // NEW ENUM</span>
  "status": "active",
  "created_at": 1726789000
}`,
  impacts: [
    {
      name: 'Checkout & Onboarding Pipeline',
      riskLabel: 'High Risk',
      riskClass: 'impact-badge-high',
      description: 'Parser expects <code>billing_address</code> field. Will throw <code>TypeError: undefined</code> during customer initialization.'
    },
    {
      name: 'User Profile Sync Daemon',
      riskLabel: 'Medium Risk',
      riskClass: 'impact-badge-med',
      description: 'Missing <code>user_tier</code> mapping will result in default downgrade fallback.'
    }
  ],
  remediateLabel: 'Update TypeScript Contract & Regenerate SDK'
};

export const initialMetrics = {
  registeredApis: 4,
  changesDetected: 2,
  workflowsProtected: 8
};
