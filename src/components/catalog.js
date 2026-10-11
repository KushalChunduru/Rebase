import { refreshIcons } from '../utils/icons.js';

export function renderCatalog(catalog, callbacks) {
  const grid = document.getElementById('catalog-services-grid');
  if (!grid) return;

  grid.innerHTML = '';
  catalog.forEach(service => {
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
      if (callbacks && callbacks.onAdd) callbacks.onAdd(service);
    });

    grid.appendChild(card);
  });

  refreshIcons();
}

export function openBrowseModal() {
  const modal = document.getElementById('modal-browse-services');
  if (modal) {
    modal.classList.remove('hidden');
    refreshIcons();
  }
}

export function closeBrowseModal() {
  const modal = document.getElementById('modal-browse-services');
  if (modal) modal.classList.add('hidden');
}

export function openAddApiModal() {
  const modal = document.getElementById('modal-add-api');
  const form = document.getElementById('form-add-api');
  if (modal) {
    if (form) form.reset();
    modal.classList.remove('hidden');
    refreshIcons();
  }
}

export function closeAddApiModal() {
  const modal = document.getElementById('modal-add-api');
  if (modal) modal.classList.add('hidden');
}
