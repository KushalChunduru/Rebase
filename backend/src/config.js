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

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || ''
  },

  pipeline: {
    autoApplyThreshold: 0.90,
    criticalRiskBlocked: true,
    sandboxTimeoutMs: 5000
  }
};
