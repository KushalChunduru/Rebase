export const config = {
  port: process.env.PORT || 3000,

  simulator: {
    baseUrl: process.env.SIMULATOR_URL || 'http://localhost:4000',
    endpoints: {
      users: '/api/users',
      products: '/api/products',
      orders: '/api/orders',
      mcpTools: '/mcp/tools',
      webhookEvents: '/webhook/events',
      schema: '/schema'
    }
  },

  pipeline: {
    autoApplyThreshold: 0.90,
    criticalRiskBlocked: true,
    sandboxTimeoutMs: 5000
  }
};
