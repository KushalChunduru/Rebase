const WS_URL = 'ws://localhost:3000/ws';

let ws = null;
let reconnectTimer = null;
const listeners = [];

export function connectWebSocket() {
  if (ws && ws.readyState <= 1) return;

  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[WS] Connected to Rebase backend');
    clearTimeout(reconnectTimer);
    notify({ type: 'ws:connected' });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      notify(data);
    } catch {}
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
    notify({ type: 'ws:disconnected' });
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectWebSocket, 3000);
}

function notify(data) {
  listeners.forEach(fn => fn(data));
}

export function onWebSocketMessage(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function isConnected() {
  return ws && ws.readyState === 1;
}
