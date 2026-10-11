const baseline = {
  users: [
    { id: 'usr_99812', name: 'Sarah Connor', email: 'sarah@cyberdyne.io', status: 'active', created_at: 1726789000 },
    { id: 'usr_10234', name: 'Kyle Reese', email: 'kyle@resistance.net', status: 'active', created_at: 1726790000 },
    { id: 'usr_55671', name: 'Miles Dyson', email: 'miles@cyberdyne.io', status: 'inactive', created_at: 1726785000 }
  ],

  products: [
    { id: 'prod_001', name: 'Neural Net Processor', price: 4999, currency: 'usd', in_stock: true, department: 'hardware' },
    { id: 'prod_002', name: 'Plasma Rifle', price: 12000, currency: 'usd', in_stock: false, department: 'weapons' },
    { id: 'prod_003', name: 'Time Displacement Unit', price: 999999, currency: 'usd', in_stock: true, department: 'equipment' }
  ],

  orders: [
    { id: 'ord_8921a', payment_id: 'pay_3kX9m', amount: 4999, currency: 'usd', status: 'completed', created_at: 1726800000 },
    { id: 'ord_8922b', payment_id: 'pay_7nR2q', amount: 12000, currency: 'usd', status: 'pending', created_at: 1726801000 }
  ],

  mcpTools: [
    {
      tool: 'delete_user',
      description: 'Deactivate user account',
      params: { user_id: { type: 'integer', required: true } },
      returns: { success: 'boolean' }
    },
    {
      tool: 'get_user',
      description: 'Retrieve user profile by ID',
      params: { user_id: { type: 'integer', required: true } },
      returns: { user: 'object' }
    },
    {
      tool: 'update_role',
      description: 'Change user role assignment',
      params: { user_id: { type: 'integer', required: true }, role: { type: 'string', required: true } },
      returns: { success: 'boolean' }
    }
  ],

  webhookEvents: [
    {
      event: 'payment_success',
      description: 'Fires when a payment is completed successfully',
      payload: { payment_id: 'pay_8xK2m', amount: 4999, currency: 'usd' }
    },
    {
      event: 'payment_failed',
      description: 'Fires when a payment attempt fails',
      payload: { payment_id: 'pay_9zL3n', amount: 2500, currency: 'usd', error_code: 'card_declined' }
    },
    {
      event: 'refund_issued',
      description: 'Fires when a refund is processed',
      payload: { payment_id: 'pay_4wM1p', refund_amount: 1500, currency: 'usd' }
    }
  ]
};

const activeMutations = new Set();
const history = [];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function getBaseline(collection) {
  return deepClone(baseline[collection]);
}

export function getActiveMutations() {
  return [...activeMutations];
}

export function isMutationActive(id) {
  return activeMutations.has(id);
}

export function applyMutation(id) {
  if (activeMutations.has(id)) return { changed: false, reason: 'already active' };
  activeMutations.add(id);
  history.push({ action: 'apply', mutation: id, timestamp: new Date().toISOString() });
  return { changed: true };
}

export function revertMutation(id) {
  if (!activeMutations.has(id)) return { changed: false, reason: 'not active' };
  activeMutations.delete(id);
  history.push({ action: 'revert', mutation: id, timestamp: new Date().toISOString() });
  return { changed: true };
}

export function resetAll() {
  const count = activeMutations.size;
  activeMutations.clear();
  history.push({ action: 'reset', timestamp: new Date().toISOString() });
  return { cleared: count };
}

export function getHistory() {
  return [...history];
}
