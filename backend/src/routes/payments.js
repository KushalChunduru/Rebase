import { Router } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { config } from '../config.js';
import { store } from '../store/index.js';
import { broadcast } from '../ws.js';

const router = Router();

function getRazorpay() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    return null;
  }
  return new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret
  });
}

// POST /api/payments/create-order — create a Razorpay test order
router.post('/create-order', async (req, res) => {
  const rzp = getRazorpay();
  if (!rzp) {
    return res.status(503).json({ error: 'Razorpay credentials not configured' });
  }

  const { amount = 500, currency = 'INR', receipt } = req.body;

  try {
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: receipt || `rcpt_rebase_${Date.now()}`
    });

    store.createOrder(order.id, {
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    });

    broadcast({
      type: 'payment:order-created',
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      timestamp: new Date().toISOString()
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId
    });
  } catch (err) {
    console.error('[PAYMENT] Order creation failed:', err.message);
    res.status(500).json({ error: 'Order creation failed', detail: err.message });
  }
});

// POST /api/payments/verify — verify payment signature after checkout
router.post('/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }

  if (!config.razorpay.keySecret) {
    return res.status(503).json({ error: 'Razorpay credentials not configured' });
  }

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');

  if (expected !== razorpay_signature) {
    console.warn('[PAYMENT] Invalid checkout signature — rejected');
    broadcast({
      type: 'payment:verification-failed',
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      timestamp: new Date().toISOString()
    });
    return res.status(400).json({ error: 'Invalid payment signature', verified: false });
  }

  console.log(`[PAYMENT] Verified: ${razorpay_payment_id} for order ${razorpay_order_id}`);

  store.updateOrder(razorpay_order_id, {
    status: 'checkout_verified',
    paymentId: razorpay_payment_id
  });

  const driftAlert = store.getWebhookDriftAlert();

  broadcast({
    type: 'payment:verified',
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    driftActive: !!driftAlert,
    timestamp: new Date().toISOString()
  });

  res.json({
    verified: true,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    driftActive: !!driftAlert,
    driftWarning: driftAlert
      ? 'Webhook drift is active — incoming webhook will be quarantined, order will NOT be fulfilled until drift is resolved'
      : null
  });
});

router.get('/orders', (req, res) => {
  res.json({ orders: store.getOrders() });
});

router.get('/orders/:orderId', (req, res) => {
  const order = store.getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

router.get('/drift-status', (req, res) => {
  const alert = store.getWebhookDriftAlert();
  res.json({ driftActive: !!alert, alert });
});

export default router;
