import express from 'express';
import cors from 'cors';
import { config } from './src/config.js';
import routes from './src/routes/index.js';
import { requestLogger } from './src/middleware/logger.js';
import { errorHandler } from './src/middleware/error-handler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rebase-backend',
    simulator: config.simulator.baseUrl,
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`\n  REBASE Backend Engine`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Local:     http://localhost:${config.port}`);
  console.log(`  API:       http://localhost:${config.port}/api`);
  console.log(`  Simulator: ${config.simulator.baseUrl}`);
  console.log(`  Health:    http://localhost:${config.port}/health\n`);
});
