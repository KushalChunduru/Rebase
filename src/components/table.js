import { refreshIcons } from '../utils/icons.js';

export function renderTable(dependencies, filter, searchQuery, callbacks) {
  const tableBody = document.getElementById('api-table-body');
  const emptyState = document.getElementById('empty-state');
  const searchFilterCount = document.getElementById('search-filter-count');
  if (!tableBody) return;

  const filtered = dependencies.filter(api => {
    if (filter !== 'all' && api.status !== filter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const fields = [
        api.name, api.description, api.baseUrl,
        api.endpoint, api.behaviour.auth || '', api.status
      ];
      if (!fields.some(f => f.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (searchFilterCount) searchFilterCount.textContent = `Showing 0 of ${dependencies.length}`;
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (searchFilterCount) searchFilterCount.textContent = `Showing ${filtered.length} of ${dependencies.length}`;

  filtered.forEach(api => {
    const tr = document.createElement('tr');
    tr.className = 'api-row';
    tr.dataset.id = api.id;

    let iconMarkup = '';
    if (api.iconType === 'stripe') {
      iconMarkup = `
        <div class="service-icon-box stripe">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
          </svg>
        </div>`;
    } else {
      const iconMap = { users: 'users', package: 'package', 'shopping-bag': 'shopping-bag', shield: 'shield', webhook: 'webhook', globe: 'globe' };
      const bgMap = { users: 'bg-purple', package: 'bg-emerald', 'shopping-bag': 'bg-amber', shield: 'bg-blue', webhook: 'bg-purple' };
      const lucideIcon = iconMap[api.iconType] || 'globe';
      const bgClass = bgMap[api.iconType] || 'bg-custom';
      iconMarkup = `<div class="service-icon-box ${bgClass}"><i data-lucide="${lucideIcon}"></i></div>`;
    }

    const methodClass = api.method.toLowerCase();

    let extraBehaviour = '';
    if (api.behaviour.rateLimit) {
      extraBehaviour = `Rate limit: ${api.behaviour.rateLimit}`;
    } else if (api.behaviour.pagination) {
      extraBehaviour = `Pagination: ${api.behaviour.pagination}`;
    }

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
    } else if (api.status === 'Auto-applied') {
      statusClass = 'auto-applied';
      statusLabel = 'Auto-applied';
    } else if (api.status === 'Blocked') {
      statusClass = 'blocked';
      statusLabel = 'Blocked';
      showInspectButton = true;
    }

    tr.innerHTML = `
      <td class="col-service">
        <div class="service-cell">
          ${iconMarkup}
          <div class="service-meta">
            <span class="service-name">${api.name}</span>
            <span class="service-desc">${api.description}</span>
          </div>
        </div>
      </td>
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
      <td class="col-action">
        <button class="row-nav-arrow" aria-label="View telemetry details">
          <i data-lucide="arrow-right"></i>
        </button>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('.copy-url-btn') || e.target.closest('.btn-row-inspect')) return;
      if (callbacks.onRowClick) callbacks.onRowClick(api);
    });

    tableBody.appendChild(tr);
  });

  document.querySelectorAll('.copy-url-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (callbacks.onCopyUrl) callbacks.onCopyUrl(btn.dataset.url);
    });
  });

  document.querySelectorAll('.btn-row-inspect').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (callbacks.onInspect) callbacks.onInspect();
    });
  });

  refreshIcons();
}
