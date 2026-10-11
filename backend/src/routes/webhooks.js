import { Router } from 'express';
import crypto from 'crypto';
import { store } from '../store/index.js';
import { broadcast } from '../ws.js';
import { config } from '../config.js';

const router = Router();

const webhookLog = [];
const processedEventIds = new Set();

function verifyRazorpaySignature(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
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

function processWebhookPayload(payload, source, isSynthetic = false) {
  const eventName = payload.event || 'unknown';
  const timestamp = new Date().toISOString();

  const entry = {
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event: eventName,
    payload,
    receivedAt: timestamp,
    source,
    synthetic: isSynthetic
  };

  webhookLog.push(entry);
  if (webhookLog.length > 100) webhookLog.shift();

  console.log(`[WEBHOOK] Received: ${eventName}${isSynthetic ? ' (SYNTHETIC)' : ''}`);

  const currentSchema = extractSchema(payload);

  const baselineKey = isSynthetic ? `razorpay-test:${eventName}` : `razorpay:${eventName}`;
  const existingBaseline = store.getBaseline(baselineKey);

  if (!existingBaseline) {
    store.setBaseline(baselineKey, { schema: currentSchema, event: eventName, samplePayload: payload });
    console.log(`[WEBHOOK] Baseline captured for ${baselineKey}`);

    broadcast({
      type: 'webhook:received',
      event: eventName,
      status: 'baseline_captured',
      timestamp,
      payload: entry,
      synthetic: isSynthetic
    });

    return { status: 'baseline_captured', baselineKey };
  }

  const drift = detectDrift(existingBaseline.schema, currentSchema);

  if (drift.length > 0) {
    console.log(`[WEBHOOK] DRIFT DETECTED on ${eventName}:`, drift);

    const observation = store.addObservation({
      dependencyId: baselineKey,
      type: 'webhook',
      event: eventName,
      source,
      drift,
      currentSchema,
      baselineSchema: existingBaseline.schema,
      samplePayload: payload,
      synthetic: isSynthetic
    });

    broadcast({
      type: 'webhook:drift',
      event: eventName,
      status: 'drift_detected',
      drift,
      observation,
      timestamp,
      synthetic: isSynthetic,
      baselineSchema: existingBaseline.schema,
      currentSchema
    });

    return { status: 'drift_detected', drift, observation, baselineKey };
  }

  broadcast({
    type: 'webhook:received',
    event: eventName,
    status: 'schema_match',
    timestamp,
    payload: entry,
    synthetic: isSynthetic
  });

  return { status: 'schema_match', baselineKey };
}

// POST /webhooks/razorpay — receives genuine Razorpay webhook events
// Uses rawBody from middleware for correct signature verification
router.post('/razorpay', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = config.razorpay.webhookSecret;

  if (secret) {
    if (!signature) {
      console.warn('[WEBHOOK] Missing Razorpay signature — rejected');
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    const rawBody = req.rawBody || JSON.stringify(req.body);
    const valid = verifyRazorpaySignature(rawBody, signature, secret);
    if (!valid) {
      console.warn('[WEBHOOK] Invalid Razorpay signature — rejected');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  const payload = req.body;

  // Deduplicate by Razorpay event id if present
  const razorpayEventId = payload?.payload?.payment?.entity?.id
    || payload?.payload?.order?.entity?.id
    || null;
  if (razorpayEventId && processedEventIds.has(razorpayEventId + ':' + payload.event)) {
    console.log(`[WEBHOOK] Duplicate event ${payload.event}:${razorpayEventId} — skipped`);
    return res.json({ status: 'duplicate', skipped: true });
  }
  if (razorpayEventId) {
    processedEventIds.add(razorpayEventId + ':' + payload.event);
    if (processedEventIds.size > 500) {
      const first = processedEventIds.values().next().value;
      processedEventIds.delete(first);
    }
  }

  // Enforce webhook drift — quarantine if active
  const driftAlert = store.getWebhookDriftAlert();
  if (driftAlert) {
    const eventName = payload.event || 'unknown';
    const orderId = payload?.payload?.payment?.entity?.order_id
      || payload?.payload?.order?.entity?.id
      || null;

    if (orderId) {
      store.updateOrder(orderId, {
        status: 'quarantined',
        quarantineReason: 'webhook_drift_active',
        quarantinedEvent: eventName,
        driftDetails: driftAlert
      });
    }

    const entry = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      event: eventName,
      payload,
      receivedAt: new Date().toISOString(),
      source: 'razorpay',
      quarantined: true,
      quarantineReason: 'webhook_drift_active'
    };
    webhookLog.push(entry);
    if (webhookLog.length > 100) webhookLog.shift();

    console.warn(`[WEBHOOK] QUARANTINED: ${eventName} — webhook drift is active (order: ${orderId || 'unknown'})`);

    broadcast({
      type: 'webhook:quarantined',
      event: eventName,
      orderId,
      reason: 'webhook_drift_active',
      driftAlert: {
        dependencyId: driftAlert.dependencyId,
        activatedAt: driftAlert.activatedAt,
        decision: driftAlert.decision
      },
      timestamp: new Date().toISOString()
    });

    return res.status(202).json({
      status: 'quarantined',
      reason: 'Webhook drift is active — event quarantined, order NOT fulfilled',
      event: eventName,
      orderId
    });
  }

  const result = processWebhookPayload(payload, 'razorpay', false);

  // On successful processing with no drift, mark order as fulfilled
  const orderId = payload?.payload?.payment?.entity?.order_id
    || payload?.payload?.order?.entity?.id
    || null;
  if (orderId && (result.status === 'schema_match' || result.status === 'baseline_captured')) {
    store.updateOrder(orderId, { status: 'fulfilled', webhookEvent: payload.event });
  }

  res.json({ status: 'ok', ...result });
});

// POST /webhooks/simulate-drift — sends a synthetic payload with type drift
// Isolated from genuine baselines using a test namespace
router.post('/simulate-drift', (req, res) => {
  const testEvent = 'payment.captured';
  const baselineKey = `razorpay-test:${testEvent}`;

  // Step 1: Ensure baseline exists with numeric amount
  const existing = store.getBaseline(baselineKey);
  if (!existing) {
    const baselinePayload = {
      event: testEvent,
      account_id: 'acc_test_synthetic',
      payload: {
        payment: {
          entity: {
            id: 'pay_SYNTHETIC_BASELINE',
            amount: 50000,
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            order_id: 'order_SYNTHETIC_001',
            description: 'Synthetic baseline',
            email: 'test@example.com',
            contact: '+919999999999'
          }
        }
      }
    };
    processWebhookPayload(baselinePayload, 'synthetic-test', true);
  }

  // Step 2: Send drifted payload — amount as string instead of number
  const driftedPayload = {
    event: testEvent,
    account_id: 'acc_test_synthetic',
    payload: {
      payment: {
        entity: {
          id: 'pay_SYNTHETIC_DRIFT_' + Date.now(),
          amount: '50000',
          currency: 'INR',
          status: 'captured',
          method: 'upi',
          order_id: 'order_SYNTHETIC_002',
          description: 'Synthetic drift test',
          email: 'test@example.com',
          contact: '+919999999999'
        }
      }
    }
  };

  const result = processWebhookPayload(driftedPayload, 'synthetic-test', true);
  res.json({
    status: 'ok',
    synthetic: true,
    label: 'SYNTHETIC TEST DATA — amount type changed from number to string',
    ...result
  });
});

// DELETE /webhooks/simulate-drift — reset synthetic test baseline
router.delete('/simulate-drift', (req, res) => {
  const testEvent = 'payment.captured';
  const baselineKey = `razorpay-test:${testEvent}`;
  store.removeBaseline(baselineKey);
  res.json({ status: 'ok', reset: true });
});

// GET /webhooks/log — view recent webhooks
router.get('/log', (req, res) => {
  res.json({ webhooks: webhookLog.slice(-20).reverse() });
});

// GET /webhooks/baselines — view captured baselines
router.get('/baselines', (req, res) => {
  const baselines = store.getAllBaselines().filter(b =>
    b && b.dependencyId && b.dependencyId.startsWith('razorpay')
  );
  res.json({ baselines });
});

export default router;
