import { refreshIcons } from '../utils/icons.js';

export function renderTelemetryFeed(events, callbacks) {
  const feed = document.getElementById('telemetry-feed');
  if (!feed) return;

  feed.innerHTML = '';

  events.forEach(event => {
    const typeClass = event.type === 'warn' ? 'warn' : (event.type === 'info' ? 'info' : '');
    const sourceClass = event.type === 'warn' ? 'warn' : (event.type === 'info' ? 'info' : '');
    const badgeClass = event.type === 'warn' ? 'warn' : (event.type === 'info' ? 'info' : 'ok');

    const el = document.createElement('div');
    el.className = `telemetry-event ${typeClass}`;
    if (event.simulated) el.classList.add('sim-event');

    el.innerHTML = `
      <div class="event-time">${event.time}</div>
      <div class="event-status-bar ${typeClass}"></div>
      <div class="event-body">
        <span class="event-source ${sourceClass}">${event.source}</span>
        <span class="event-msg">${event.message}</span>
      </div>
      <span class="event-badge ${badgeClass}">${event.badge}</span>
      ${event.actionable ? `
        <button class="event-action-btn" data-event-id="${event.id}">
          <i data-lucide="arrow-up-right"></i>
        </button>
      ` : ''}
    `;

    feed.appendChild(el);
  });

  feed.querySelectorAll('.event-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (callbacks && callbacks.onEventAction) callbacks.onEventAction(btn.dataset.eventId);
    });
  });

  refreshIcons();
}
