import { createIcons, icons } from 'lucide';

// ============================================================
// DATA STORE: REGISTERED APIS
// Exact specifications from user requirements
// ============================================================
let apiDependencies = [
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

// Catalog of discoverable services for "Browse Services"
const discoverableCatalog = [
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

// State variables
let currentFilter = 'all';
let currentSearchQuery = '';
let selectedApiForDrawer = null;

// ============================================================
// DOM ELEMENTS
// ============================================================
const tableBody = document.getElementById('api-table-body');
const searchInput = document.getElementById('api-search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const searchFilterCount = document.getElementById('search-filter-count');
const filterChips = document.querySelectorAll('.filter-chip');
const emptyState = document.getElementById('empty-state');

// Modals & Popovers
const modalInspectChange = document.getElementById('modal-inspect-change');
const modalCloseInspect = document.getElementById('modal-close-inspect');
const btnDismissInspect = document.getElementById('btn-dismiss-inspect');
const btnRemediateInspect = document.getElementById('btn-remediate-inspect');
const btnInspectSummary = document.getElementById('btn-inspect-summary');
const btnHeroBrowse = document.getElementById('btn-hero-browse');
const btnHeroAdd = document.getElementById('btn-hero-add');
const notifInspectBtn = document.getElementById('notif-inspect-btn');
const btnStemDetails = document.getElementById('btn-stem-details');

const modalBrowseServices = document.getElementById('modal-browse-services');
const btnBrowseServices = document.getElementById('btn-browse-services');
const modalCloseBrowse = document.getElementById('modal-close-browse');
const btnCloseBrowseFooter = document.getElementById('btn-close-browse-footer');
const catalogServicesGrid = document.getElementById('catalog-services-grid');

const modalAddApi = document.getElementById('modal-add-api');
const btnAddApi = document.getElementById('btn-add-api');
const btnAddApiTop = document.getElementById('btn-add-api-top');
const modalCloseAdd = document.getElementById('modal-close-add');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const formAddApi = document.getElementById('form-add-api');

const drawerApiDetails = document.getElementById('drawer-api-details');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const btnDrawerCloseAction = document.getElementById('btn-drawer-close-action');
const btnDrawerPing = document.getElementById('btn-drawer-ping');
const drawerServiceName = document.getElementById('drawer-service-name');
const drawerBodyContent = document.getElementById('drawer-body-content');

const btnNotifications = document.getElementById('btn-notifications');
const notificationsPopover = document.getElementById('notifications-popover');

const userProfileToggle = document.getElementById('user-profile-toggle');
const profileMenu = document.getElementById('profile-menu');

const btnQuickSearch = document.getElementById('btn-quick-search');
const btnResetSearch = document.getElementById('btn-reset-search');
const toastContainer = document.getElementById('toast-container');

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderTable();
  renderCatalog();
  attachEventListeners();
  initHeroGraph();
  refreshLucideIcons();
});

function refreshLucideIcons() {
  createIcons({ icons });
}

// ============================================================
// RENDER TABLE
// ============================================================
function renderTable() {
  const filtered = apiDependencies.filter(api => {
    // Status filter
    if (currentFilter !== 'all' && api.status !== currentFilter) {
      return false;
    }
    // Search query filter
    if (currentSearchQuery.trim() !== '') {
      const q = currentSearchQuery.toLowerCase();
      const matchName = api.name.toLowerCase().includes(q);
      const matchDesc = api.description.toLowerCase().includes(q);
      const matchUrl = api.baseUrl.toLowerCase().includes(q);
      const matchEndpoint = api.endpoint.toLowerCase().includes(q);
      const matchAuth = (api.behaviour.auth || '').toLowerCase().includes(q);
      const matchStatus = api.status.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchUrl && !matchEndpoint && !matchAuth && !matchStatus) {
        return false;
      }
    }
    return true;
  });

  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    searchFilterCount.textContent = `Showing 0 of ${apiDependencies.length}`;
    return;
  } else {
    emptyState.classList.add('hidden');
    searchFilterCount.textContent = `Showing ${filtered.length} of ${apiDependencies.length}`;
  }

  filtered.forEach(api => {
    const tr = document.createElement('tr');
    tr.className = 'api-row';
    tr.dataset.id = api.id;

    // Icon markup
    let iconMarkup = '';
    if (api.iconType === 'stripe') {
      iconMarkup = `
        <div class="service-icon-box stripe">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
          </svg>
        </div>`;
    } else if (api.iconType === 'users') {
      iconMarkup = `<div class="service-icon-box bg-purple"><i data-lucide="users"></i></div>`;
    } else if (api.iconType === 'package') {
      iconMarkup = `<div class="service-icon-box bg-emerald"><i data-lucide="package"></i></div>`;
    } else if (api.iconType === 'shopping-bag') {
      iconMarkup = `<div class="service-icon-box bg-amber"><i data-lucide="shopping-bag"></i></div>`;
    } else {
      iconMarkup = `<div class="service-icon-box bg-custom"><i data-lucide="globe"></i></div>`;
    }

    // Method badge
    const methodClass = api.method.toLowerCase();

    // Behaviour extra details (rate limit or pagination)
    let extraBehaviour = '';
    if (api.behaviour.rateLimit) {
      extraBehaviour = `Rate limit: ${api.behaviour.rateLimit}`;
    } else if (api.behaviour.pagination) {
      extraBehaviour = `Pagination: ${api.behaviour.pagination}`;
    }

    // Status formatting
    let statusClass = 'monitoring';
    let statusLabel = 'Monitoring';
    let showInspectButton = false;

    if (api.status === 'Change detected') {
      statusClass = 'change-detected';
      statusLabel = 'Change detected';
      showInspectButton = true;
    } else if (api.status === 'Review required') {
      statusClass = 'review-required';
      statusLabel = 'Review required';
    }

    tr.innerHTML = `
      <!-- Column 1: Service -->
      <td class="col-service">
        <div class="service-cell">
          ${iconMarkup}
          <div class="service-meta">
            <span class="service-name">${api.name}</span>
            <span class="service-desc">${api.description}</span>
          </div>
        </div>
      </td>

      <!-- Column 2: Base URL / Endpoints -->
      <td class="col-endpoint">
        <div class="endpoint-cell">
          <div class="base-url-line">
            <span>${api.baseUrl}</span>
            <button class="copy-url-btn" data-url="${api.baseUrl}" title="Copy base URL">
              <i data-lucide="copy"></i>
            </button>
          </div>
          <div class="endpoint-method-line">
            <span class="method-badge ${methodClass}">${api.method}</span>
            <span class="endpoint-path">${api.path}</span>
          </div>
        </div>
      </td>

      <!-- Column 3: Behaviour -->
      <td class="col-behaviour">
        <div class="behaviour-cell">
          <div class="behaviour-tags-row">
            <span class="behaviour-pill">${api.behaviour.format}</span>
            <span class="behaviour-pill auth">${api.behaviour.auth}</span>
            <span class="behaviour-pill">${api.behaviour.version}</span>
          </div>
          ${extraBehaviour ? `<div class="behaviour-extra-row">${extraBehaviour}</div>` : ''}
        </div>
      </td>

      <!-- Column 4: Status -->
      <td class="col-status">
        <div class="status-cell">
          <div class="status-badge ${statusClass}">
            <span class="status-pulse-dot"></span>
            <span>${statusLabel}</span>
          </div>
          ${showInspectButton ? `
            <button class="btn-row-inspect" data-action="inspect" data-id="${api.id}">
              <i data-lucide="search"></i>
              <span>Inspect Change</span>
            </button>
          ` : ''}
        </div>
      </td>

      <!-- Column 5: Action Navigation -->
      <td class="col-action">
        <button class="row-nav-arrow" aria-label="View telemetry details">
          <i data-lucide="arrow-right"></i>
        </button>
      </td>
    `;

    // Row click listeners
    tr.addEventListener('click', (e) => {
      // If clicked on copy button or inspect button, prevent opening row drawer
      if (e.target.closest('.copy-url-btn') || e.target.closest('.btn-row-inspect')) {
        return;
      }
      openApiDrawer(api);
    });

    tableBody.appendChild(tr);
  });

  // Re-attach event listeners on newly generated rows
  document.querySelectorAll('.copy-url-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      navigator.clipboard.writeText(url).then(() => {
        showToast(`Copied to clipboard: ${url}`, 'success');
      });
    });
  });

  document.querySelectorAll('.btn-row-inspect').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInspectModal();
    });
  });

  refreshLucideIcons();
}

// ============================================================
// RENDER BROWSE CATALOG
// ============================================================
function renderCatalog() {
  catalogServicesGrid.innerHTML = '';
  discoverableCatalog.forEach(service => {
    const card = document.createElement('div');
    card.className = 'catalog-card';
    card.innerHTML = `
      <div class="catalog-card-left">
        <div class="catalog-icon" style="background: ${service.iconBg}; color: #ffffff;">
          <i data-lucide="${service.icon}"></i>
        </div>
        <div>
          <div class="catalog-title">${service.name}</div>
          <div class="catalog-sub">${service.description}</div>
        </div>
      </div>
      <button class="btn-catalog-add" data-name="${service.name}">+ Add</button>
    `;

    card.querySelector('.btn-catalog-add').addEventListener('click', () => {
      // Add this service to dependencies
      const newApi = {
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
        samplePayload: `{ "service": "${service.name}", "status": "active" }`
      };

      // Check if already registered
      if (apiDependencies.some(a => a.name === newApi.name)) {
        showToast(`${service.name} is already registered!`, 'info');
        return;
      }

      apiDependencies.unshift(newApi);
      renderTable();
      updateMetricsCount();
      modalBrowseServices.classList.add('hidden');
      showToast(`Registered dependency: ${service.name} into radar`, 'success');
    });

    catalogServicesGrid.appendChild(card);
  });
}

function updateMetricsCount() {
  const regCount = document.querySelector('.metric-card-white .metric-giant-number');
  const navCount = document.querySelector('.nav-counter');
  if (regCount) {
    regCount.textContent = String(apiDependencies.length).padStart(2, '0');
  }
  if (navCount) {
    navCount.textContent = String(apiDependencies.length).padStart(2, '0');
  }
}

// ============================================================
// MODAL & DRAWER CONTROLLERS
// ============================================================
function openInspectModal() {
  modalInspectChange.classList.remove('hidden');
  refreshLucideIcons();
}

function closeInspectModal() {
  modalInspectChange.classList.add('hidden');
}

function openBrowseModal() {
  modalBrowseServices.classList.remove('hidden');
  refreshLucideIcons();
}

function closeBrowseModal() {
  modalBrowseServices.classList.add('hidden');
}

function openAddApiModal() {
  modalAddApi.classList.remove('hidden');
  formAddApi.reset();
  refreshLucideIcons();
}

function closeAddApiModal() {
  modalAddApi.classList.add('hidden');
}

function openApiDrawer(api) {
  selectedApiForDrawer = api;
  drawerServiceName.textContent = api.name;

  drawerBodyContent.innerHTML = `
    <!-- Metrics Row -->
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

    <!-- Endpoint Overview -->
    <div>
      <div class="drawer-section-title">ENDPOINT CONTRACT</div>
      <div class="drawer-code-box">
        <div><strong>Base URL:</strong> ${api.baseUrl}</div>
        <div><strong>Path:</strong> <code>${api.endpoint}</code></div>
        <div><strong>Auth Protocol:</strong> ${api.behaviour.auth}</div>
        <div><strong>Data Format:</strong> ${api.behaviour.format} (${api.behaviour.version})</div>
        ${api.behaviour.rateLimit ? `<div><strong>Rate Limit:</strong> ${api.behaviour.rateLimit}</div>` : ''}
        ${api.behaviour.pagination ? `<div><strong>Pagination:</strong> ${api.behaviour.pagination}</div>` : ''}
      </div>
    </div>

    <!-- cURL Command -->
    <div>
      <div class="drawer-section-title">CURL PROBE COMMAND</div>
      <div class="drawer-code-box" id="drawer-curl-snippet">
        curl -X ${api.method} "${api.baseUrl}${api.path}" \\<br />
        &nbsp;&nbsp;-H "Content-Type: application/json" \\<br />
        &nbsp;&nbsp;-H "Authorization: ${api.behaviour.auth === 'no authentication' ? 'None' : 'Bearer $SECRET_KEY'}"
      </div>
    </div>

    <!-- Schema Sample Payload -->
    <div>
      <div class="drawer-section-title">ACTIVE AST SCHEMA INVARIANT</div>
      <div class="drawer-code-box">
        <pre><code>${api.samplePayload}</code></pre>
      </div>
    </div>

    <div id="probe-ping-result" class="hidden"></div>
  `;

  drawerApiDetails.classList.remove('hidden');
  refreshLucideIcons();
}

function closeApiDrawer() {
  drawerApiDetails.classList.add('hidden');
  selectedApiForDrawer = null;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function attachEventListeners() {
  // Search input with instant filtering
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    if (currentSearchQuery.length > 0) {
      searchClearBtn.classList.remove('hidden');
    } else {
      searchClearBtn.classList.add('hidden');
    }
    renderTable();
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    searchClearBtn.classList.add('hidden');
    renderTable();
    searchInput.focus();
  });

  btnResetSearch.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    searchClearBtn.classList.add('hidden');
    currentFilter = 'all';
    filterChips.forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
    renderTable();
  });

  // Filter chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderTable();
    });
  });

  // Inspect Change triggers
  if (btnInspectSummary) btnInspectSummary.addEventListener('click', openInspectModal);
  if (btnHeroBrowse) btnHeroBrowse.addEventListener('click', openBrowseModal);
  if (btnHeroAdd) btnHeroAdd.addEventListener('click', openAddApiModal);
  if (notifInspectBtn) notifInspectBtn.addEventListener('click', () => {
    notificationsPopover.classList.add('hidden');
    openInspectModal();
  });
  if (btnStemDetails) btnStemDetails.addEventListener('click', openInspectModal);

  modalCloseInspect.addEventListener('click', closeInspectModal);
  btnDismissInspect.addEventListener('click', closeInspectModal);

  // Remediate button in Inspect Modal
  btnRemediateInspect.addEventListener('click', () => {
    // Find customer directory and mark as remediated/monitoring
    const customerDir = apiDependencies.find(a => a.id === 'customer-directory');
    if (customerDir) {
      customerDir.status = 'Monitoring';
      customerDir.behaviour.version = 'v2 (Remediated)';
    }

    // Update changes detected metric card count from 02 to 01!
    const changesNumber = document.querySelector('.metric-card-coral .metric-giant-number');
    if (changesNumber) {
      changesNumber.textContent = '01';
    }
    const notifPill = document.querySelector('.nav-alert-pill');
    if (notifPill) {
      notifPill.textContent = '1 ALERT';
    }
    const notifInd = document.querySelector('.notification-indicator');
    if (notifInd) {
      notifInd.textContent = '1';
    }
    const notifItem = document.getElementById('notif-customer-dir');
    if (notifItem) {
      notifItem.classList.remove('unread');
    }

    closeInspectModal();
    renderTable();
    showToast('TypeScript contracts updated & SDK regenerated successfully!', 'success');
  });

  // Browse Services triggers
  btnBrowseServices.addEventListener('click', openBrowseModal);
  modalCloseBrowse.addEventListener('click', closeBrowseModal);
  btnCloseBrowseFooter.addEventListener('click', closeBrowseModal);

  // Add API triggers
  btnAddApi.addEventListener('click', openAddApiModal);
  btnAddApiTop.addEventListener('click', openAddApiModal);
  modalCloseAdd.addEventListener('click', closeAddApiModal);
  btnCancelAdd.addEventListener('click', closeAddApiModal);

  // Form Submit Add API
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

    const newDep = {
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
      status: status,
      iconType: 'custom',
      latencyP95: '45ms',
      uptime: '100.0%',
      lastObserved: 'Just registered',
      samplePayload: `{\n  "service": "${name}",\n  "status": "ready"\n}`
    };

    apiDependencies.unshift(newDep);
    renderTable();
    updateMetricsCount();
    closeAddApiModal();
    showToast(`Successfully registered ${name}!`, 'success');
  });

  // Drawer events
  drawerCloseBtn.addEventListener('click', closeApiDrawer);
  btnDrawerCloseAction.addEventListener('click', closeApiDrawer);

  btnDrawerPing.addEventListener('click', () => {
    const pingResultBox = document.getElementById('probe-ping-result');
    if (pingResultBox && selectedApiForDrawer) {
      pingResultBox.classList.remove('hidden');
      pingResultBox.className = 'drawer-code-box';
      pingResultBox.innerHTML = `
        <div style="color: #22c55e; margin-bottom: 4px;">
          <strong>PROBE RESULT: 200 OK (${Math.floor(Math.random() * 25 + 20)}ms)</strong>
        </div>
        <div>Invariant verified &bull; Headers: Content-Type: application/json; charset=utf-8</div>
        <div style="color: #94a3b8; font-size: 0.72rem; margin-top: 4px;">AST schema checksum match [0x9af27c1]</div>
      `;
      showToast(`Probe completed for ${selectedApiForDrawer.name}: 200 OK`, 'success');
    }
  });

  // Notifications popover toggle
  btnNotifications.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationsPopover.classList.toggle('hidden');
    profileMenu.classList.add('hidden');
  });

  // Profile menu toggle
  userProfileToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('hidden');
    notificationsPopover.classList.add('hidden');
  });

  // Outside click handler to dismiss popovers
  document.addEventListener('click', (e) => {
    if (!notificationsPopover.contains(e.target) && !btnNotifications.contains(e.target)) {
      notificationsPopover.classList.add('hidden');
    }
    if (!profileMenu.contains(e.target) && !userProfileToggle.contains(e.target)) {
      profileMenu.classList.add('hidden');
    }
  });

  // Keyboard shortcut Cmd/Ctrl + K to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape') {
      closeInspectModal();
      closeBrowseModal();
      closeAddApiModal();
      closeApiDrawer();
      notificationsPopover.classList.add('hidden');
      profileMenu.classList.add('hidden');
    }
  });

  btnQuickSearch.addEventListener('click', () => {
    searchInput.focus();
  });

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-collapsed');
    });
  }

  // Sidebar navigation switching
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      if (view === 'breakers') {
        openInspectModal();
      } else if (view && view !== 'apis') {
        showToast(`Switched view to ${link.querySelector('span').textContent}`, 'info');
      }
    });
  });
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'info'}"></i>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  refreshLucideIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
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
    node.addEventListener('mouseenter', (e) => {
      const text = node.getAttribute('data-tooltip');
      tooltip.textContent = text;
      tooltip.classList.add('visible');

      const circle = node.querySelector('circle');
      const ctm = circle.getCTM();
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const cx = parseFloat(circle.getAttribute('cx'));
      const cy = parseFloat(circle.getAttribute('cy'));
      const pt = svg.createSVGPoint();
      pt.x = cx;
      pt.y = cy;
      const screenPt = pt.matrixTransform(ctm);

      const tooltipX = screenPt.x - containerRect.left;
      const tooltipY = screenPt.y - containerRect.top - 44;

      tooltip.style.left = tooltipX + 'px';
      tooltip.style.top = tooltipY + 'px';
      tooltip.style.transform = 'translate(-50%, 0)';
    });

    node.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });

    node.addEventListener('click', () => {
      const status = node.getAttribute('data-status');
      if (status === 'warn') {
        const inspectBtn = document.getElementById('btn-inspect-summary');
        if (inspectBtn) inspectBtn.click();
      }
    });
  });
}
