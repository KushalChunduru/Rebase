const BACKEND_URL = 'http://localhost:3000';
const SIMULATOR_URL = 'http://localhost:4000';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const apiService = {
  async checkBackend() {
    try {
      await request(`${BACKEND_URL}/health`);
      return true;
    } catch {
      return false;
    }
  },

  async getDependencies() {
    const data = await request(`${BACKEND_URL}/api/dependencies`);
    return data.dependencies;
  },

  async addDependency(dep) {
    return request(`${BACKEND_URL}/api/dependencies`, {
      method: 'POST',
      body: JSON.stringify(dep)
    });
  },

  async runPipeline(dependencyId) {
    return request(`${BACKEND_URL}/api/pipeline/run/${dependencyId}`, {
      method: 'POST'
    });
  },

  async getPipelineRuns(limit = 20) {
    const data = await request(`${BACKEND_URL}/api/pipeline/runs?limit=${limit}`);
    return data.runs;
  },

  async getPipelineRun(runId) {
    return request(`${BACKEND_URL}/api/pipeline/runs/${runId}`);
  },

  async getObservations(dependencyId) {
    const url = dependencyId
      ? `${BACKEND_URL}/api/observations?dependencyId=${dependencyId}`
      : `${BACKEND_URL}/api/observations`;
    const data = await request(url);
    return data.observations;
  },

  // Simulator control
  async simulatorApplyMutation(mutationId) {
    return request(`${SIMULATOR_URL}/control/mutate`, {
      method: 'POST',
      body: JSON.stringify({ id: mutationId })
    });
  },

  async simulatorReset() {
    return request(`${SIMULATOR_URL}/control/reset`, {
      method: 'POST'
    });
  },

  async simulatorStatus() {
    return request(`${SIMULATOR_URL}/control/status`);
  },

  // Razorpay payments
  async createOrder(amount = 500, currency = 'INR') {
    return request(`${BACKEND_URL}/api/payments/create-order`, {
      method: 'POST',
      body: JSON.stringify({ amount, currency })
    });
  },

  async verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature) {
    return request(`${BACKEND_URL}/api/payments/verify`, {
      method: 'POST',
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature })
    });
  },

  // Drift simulation
  async simulateDrift() {
    return request(`${BACKEND_URL}/webhooks/simulate-drift`, { method: 'POST' });
  },

  async resetDriftSimulation() {
    return request(`${BACKEND_URL}/webhooks/simulate-drift`, { method: 'DELETE' });
  },

  async getDriftStatus() {
    return request(`${BACKEND_URL}/api/payments/drift-status`);
  },

  async getOrderStatus(orderId) {
    return request(`${BACKEND_URL}/api/payments/orders/${orderId}`);
  },

  async getMcpTools() {
    return request(`${SIMULATOR_URL}/mcp/tools`);
  },

  async updateMcpTool(toolName, description) {
    return request(`${SIMULATOR_URL}/mcp/tools/${toolName}`, {
      method: 'PUT',
      body: JSON.stringify({ description })
    });
  },

  async restoreMcpTool(toolName) {
    return request(`${SIMULATOR_URL}/mcp/tools/${toolName}/edit`, { method: 'DELETE' });
  },

  async restoreAllMcpTools() {
    return request(`${SIMULATOR_URL}/mcp/tools/restore-all`, { method: 'POST' });
  },

  async getMcpEdits() {
    return request(`${SIMULATOR_URL}/mcp/edits`);
  },

  async executeMcpTool(toolName, params, dependencyId) {
    return request(`${BACKEND_URL}/api/pipeline/mcp/execute`, {
      method: 'POST',
      body: JSON.stringify({ toolName, params, dependencyId })
    });
  }
};
