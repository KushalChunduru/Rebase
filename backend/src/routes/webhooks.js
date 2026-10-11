import { Router } from 'express';
import crypto from 'crypto';
import { store } from '../store/index.js';
import { broadcast } from '../ws.js';

const router = Router();

const webhookLog = [];

function verifyRazorpaySignature(body, signature, secret) {
  if (!secret || !signature) return true;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

function extractSchema(obj, path = '') {
  const schema = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (value === null) {
      schema[fullPath] = 'null';
    } else if (Array.isArray(value)) {
      schema[fullPath] = 'array';
      if (value.length > 0 && typeof value[0] === 'object') {
        Object.assign(schema, extractSchema(value[0], `${fullPath}[]`));
      }
    } else if (typeof value === 'object') {
      schema[fullPath] = 'object';
      Object.assign(schema, extractSchema(value, fullPath));
    } else {
      schema[fullPath] = typeof value;
    }
  }
  return schema;
}

function detectDrift(baseline, current) {
  const changes = [];

  for (const [field, type] of Object.entries(baseline)) {
    if (!(field in current)) {
      changes.push({ field, change: 'removed', was: type, now: null });
    } else if (current[field] !== type) {
      changes.push({ field, change: 'type_changed', was: type, now: current[field] });
    }
  }

  for (const [field, type] of Object.entries(current)) {
    if (!(field in baseline)) {
      changes.push({ field, change: 'added', was: null, now: type });
    }
  }

  return changes;
}

// POST /webhooks/razorpay — receives Razorpay webhook events
router.post('/razorpay', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (secret && signature) {
    const valid = verifyRazorpaySignature(JSON.stringify(req.body), signature, secret);
    if (!valid) {
      console.warn('[WEBHOOK] Invalid Razorpay signature — rejected');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  const payload = req.body;
  const eventName = payload.event || 'unknown';
  const timestamp = new Date().toISOString();

  const entry = {
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event: eventName,
    payload,
    receivedAt: timestamp,
    source: 'razorpay'
  };

  webhookLog.push(entry);
  if (webhookLog.length > 100) webhookLog.shift();

  console.log(`[WEBHOOK] Received: ${eventName}`);

  const currentSchema = extractSchema(payload);

  const baselineKey = `razorpay:${eventName}`;
  const existingBaseline = store.getBaseline(baselineKey);

  if (!existingBaseline) {
    store.setBaseline(baselineKey, { schema: currentSchema, event: eventName, samplePayload: payload });
    console.log(`[WEBHOOK] Baseline captured for ${eventName}`);

    broadcast({
      type: 'webhook:received',
      event: eventName,
      status: 'baseline_captured',
      timestamp,
      payload: entry
    });
  } else {
    const drift = detectDrift(existingBaseline.schema, currentSchema);

    if (drift.length > 0) {
      console.log(`[WEBHOOK] DRIFT DETECTED on ${eventName}:`, drift);

      const observation = store.addObservation({
        dependencyId: baselineKey,
        type: 'webhook',
        event: eventName,
        source: 'razorpay',
        drift,
        currentSchema,
        baselineSchema: existingBaseline.schema,
        samplePayload: payload
      });

      broadcast({
        type: 'webhook:drift',
        event: eventName,
        status: 'drift_detected',
        drift,
        observation,
        timestamp
      });
    } else {
      broadcast({
        type: 'webhook:received',
        event: eventName,
        status: 'schema_match',
        timestamp,
        payload: entry
      });
    }
  }

  res.json({ status: 'ok' });
});

// GET /webhooks/log — view recent webhooks
router.get('/log', (req, res) => {
  res.json({ webhooks: webhookLog.slice(-20).reverse() });
});

// GET /webhooks/baselines — view captured baselines
router.get('/baselines', (req, res) => {
  const baselines = store.getAllBaselines().filter(b => b.dependencyId.startsWith('razorpay:'));
  res.json({ baselines });
});

export default router;
