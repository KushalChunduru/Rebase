import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import apiRoutes from './src/routes/api.js';
import mcpRoutes from './src/routes/mcp.js';
import webhookRoutes from './src/routes/webhook.js';
import schemaRoutes from './src/routes/schema.js';
import controlRoutes from './src/routes/control.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.use('/api', apiRoutes);
app.use('/mcp', mcpRoutes);
app.use('/webhook', webhookRoutes);
app.use('/schema', schemaRoutes);
app.use('/control', controlRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rebase-simulator', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n  REBASE Dependency Simulator`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Control:  http://localhost:${PORT}/control/status`);
  console.log(`  Health:   http://localhost:${PORT}/health\n`);
});
