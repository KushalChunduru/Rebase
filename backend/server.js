import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './src/config.js';
import routes from './src/routes/index.js';
import webhooksRouter from './src/routes/webhooks.js';
import paymentsRouter from './src/routes/payments.js';
import sdksRouter from './src/routes/sdks.js';
import chatRouter from './src/routes/chat.js';
import { requestLogger } from './src/middleware/logger.js';
import { errorHandler } from './src/middleware/error-handler.js';
import { initWebSocket } from './src/ws.js';
import { store } from './src/store/index.js';

const app = express();
const server = http.createServer(app);

initWebSocket(server);

app.use(cors());

// Capture raw body for webhook signature verification on the webhook path,
// while still parsing JSON for all routes.
app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/webhooks/')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));

app.use(requestLogger);

app.use('/api', routes);
app.use('/api/payments', paymentsRouter);
app.use('/api/sdks', sdksRouter);
app.use('/api/chat', chatRouter);
app.use('/webhooks', webhooksRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rebase-backend',
    simulator: config.simulator.baseUrl,
    razorpayConfigured: !!(config.razorpay.keyId && config.razorpay.keySecret),
    webhookDriftActive: !!store.getWebhookDriftAlert(),
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

server.listen(config.port, () => {
  console.log(`\n  REBASE Backend Engine`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Local:     http://localhost:${config.port}`);
  console.log(`  API:       http://localhost:${config.port}/api`);
  console.log(`  Payments:  http://localhost:${config.port}/api/payments`);
  console.log(`  Webhooks:  http://localhost:${config.port}/webhooks/razorpay`);
  console.log(`  WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`  Simulator: ${config.simulator.baseUrl}`);
  console.log(`  Health:    http://localhost:${config.port}/health`);
  console.log(`  Razorpay:  ${config.razorpay.keyId ? 'Configured ✓' : 'Not configured'}\n`);
});
