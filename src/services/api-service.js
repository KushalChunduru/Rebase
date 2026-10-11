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
  }
};
