import { WebSocketServer } from 'ws';

let wss = null;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    ws.send(JSON.stringify({ type: 'connected', message: 'Rebase WebSocket active' }));

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });
  });

  console.log(`  WebSocket: ws://localhost:${server.address()?.port || '?'}/ws`);
  return wss;
}

export function broadcast(data) {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}
