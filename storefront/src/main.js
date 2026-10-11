const BACKEND = 'http://localhost:3000';

// ── API helpers ──
async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── WebSocket for live order updates ──
let ws = null;
const wsListeners = [];

function connectWS() {
  if (ws && ws.readyState <= 1) return;
  try { ws = new WebSocket('ws://localhost:3000/ws'); } catch { return setTimeout(connectWS, 3000); }
  ws.onopen = () => {
    document.getElementById('store-connection-badge').textContent = 'Live';
    document.getElementById('store-connection-badge').classList.add('connected');
  };
  ws.onmessage = (e) => {
    try { const d = JSON.parse(e.data); wsListeners.forEach(fn => fn(d)); } catch {}
  };
  ws.onclose = () => {
    document.getElementById('store-connection-badge').textContent = 'Reconnecting...';
    document.getElementById('store-connection-badge').classList.remove('connected');
    setTimeout(connectWS, 3000);
  };
  ws.onerror = () => ws.close();
}

function onWS(fn) { wsListeners.push(fn); }

// ── Order tracker helpers ──
function setStep(step, state) {
  const el = document.querySelector(`.store-step[data-step="${step}"]`);
  if (!el) return;
  el.classList.remove('done', 'active', 'blocked');
  if (state) el.classList.add(state);
}

function resetSteps() {
  document.querySelectorAll('.store-step').forEach(el => el.classList.remove('done', 'active', 'blocked'));
}

// ── Buy Now ──
async function handleBuy() {
  const btn = document.getElementById('btn-buy');
  const status = document.getElementById('store-status');
  const panel = document.getElementById('order-panel');
  const details = document.getElementById('order-details');
  const title = document.getElementById('order-title');
  const qBanner = document.getElementById('quarantine-banner');

  btn.disabled = true;
  status.textContent = 'Creating order...';
  status.className = 'store-status pending';
  panel.classList.add('hidden');
  panel.querySelector('.store-order-card').classList.remove('quarantined');
  qBanner.classList.add('hidden');
  resetSteps();

  try {
    const order = await api(`${BACKEND}/api/payments/create-order`, {
      method: 'POST', body: JSON.stringify({ amount: 500 })
    });

    status.textContent = 'Opening checkout...';
    setStep('checkout', 'active');

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Rebase Store',
      description: 'Rebase Pro Headphones',
      order_id: order.orderId,
      handler: async (response) => {
        setStep('checkout', 'done');
        setStep('signature', 'active');
        status.textContent = 'Verifying signature...';

        try {
          const v = await api(`${BACKEND}/api/payments/verify`, {
            method: 'POST',
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          if (!v.verified) throw new Error('Signature mismatch');

          setStep('signature', 'done');
          setStep('webhook', 'active');

          panel.classList.remove('hidden');
          title.textContent = v.driftActive ? 'Checkout Verified — Drift Active' : 'Order Processing';
          details.innerHTML =
            `<strong>Order:</strong> ${v.orderId}<br>` +
            `<strong>Payment:</strong> ${v.paymentId}<br>` +
            `<strong>Amount:</strong> ₹${(order.amount / 100).toFixed(2)}<br>` +
            (v.driftActive
              ? `<span class="text-orange">⚠ ${v.driftWarning}</span><br><strong>Status:</strong> Awaiting webhook — will be quarantined`
              : `<strong>Status:</strong> Signature verified — awaiting webhook`);

          status.textContent = v.driftActive ? 'Drift active — webhook may be quarantined' : 'Verified — awaiting webhook';
          status.className = v.driftActive ? 'store-status error' : 'store-status success';
        } catch (err) {
          status.textContent = 'Verification failed';
          status.className = 'store-status error';
        }
        btn.disabled = false;
      },
      modal: {
        ondismiss: () => {
          status.textContent = 'Cancelled';
          status.className = 'store-status error';
          btn.disabled = false;
          setTimeout(() => { status.textContent = 'Ready to purchase'; status.className = 'store-status'; }, 3000);
        }
      },
      prefill: { name: 'Rebase Demo User', email: 'demo@rebase.dev', contact: '9999999999' },
      theme: { color: '#d4f938' }
    };

    if (typeof window.Razorpay === 'undefined') throw new Error('Razorpay SDK not loaded');
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (r) => {
      status.textContent = 'Payment failed';
      status.className = 'store-status error';
      btn.disabled = false;
    });
    rzp.open();
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className = 'store-status error';
    btn.disabled = false;
  }
}

// ── WebSocket event handlers ──
function initWSHandlers() {
  onWS((data) => {
    const panel = document.getElementById('order-panel');
    const details = document.getElementById('order-details');
    const title = document.getElementById('order-title');
    const status = document.getElementById('store-status');
    const qBanner = document.getElementById('quarantine-banner');

    // Webhook received — schema matches → order fulfilled
    if (data.type === 'webhook:received' && data.status === 'schema_match' && !data.synthetic) {
      setStep('webhook', 'done');
      setStep('fulfilled', 'done');
      if (!panel.classList.contains('hidden')) {
        title.textContent = 'Order Fulfilled';
        details.innerHTML += `<br><span class="text-green">✓ Webhook: ${data.event} — schema verified</span><br><span class="text-green">✓ Order confirmed and fulfilled</span>`;
      }
      status.textContent = 'Order fulfilled ✓';
      status.className = 'store-status success';
    }

    // Webhook quarantined — drift enforcement
    if (data.type === 'webhook:quarantined') {
      setStep('webhook', 'blocked');
      setStep('fulfilled', 'blocked');
      if (!panel.classList.contains('hidden')) {
        title.textContent = 'Order Quarantined';
        panel.querySelector('.store-order-card').classList.add('quarantined');
        qBanner.classList.remove('hidden');
        const reason = document.getElementById('quarantine-reason');
        reason.textContent = `${data.event} blocked — webhook drift active on ${data.driftAlert?.dependencyName || 'dependency'}. Order NOT fulfilled.`;
      }
      status.textContent = 'Quarantined — order blocked';
      status.className = 'store-status error';
    }

    // Baseline captured
    if (data.type === 'webhook:received' && data.status === 'baseline_captured' && !data.synthetic) {
      setStep('webhook', 'done');
      setStep('fulfilled', 'done');
      if (!panel.classList.contains('hidden')) {
        title.textContent = 'Order Fulfilled';
        details.innerHTML += `<br><span class="text-green">✓ Webhook baseline captured — order confirmed</span>`;
      }
      status.textContent = 'Order fulfilled ✓';
      status.className = 'store-status success';
    }
  });
}

// ── Init ──
document.getElementById('btn-buy').addEventListener('click', handleBuy);
connectWS();
initWSHandlers();
