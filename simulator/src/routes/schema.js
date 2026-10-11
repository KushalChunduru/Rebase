import { Router } from 'express';
import { getBaseline, getActiveMutations } from '../state.js';
import { getMutation } from '../mutations.js';

const router = Router();

const baseSchemas = {
  users: {
    $id: 'customer-directory/users',
    type: 'object',
    required: ['id', 'name', 'email', 'status', 'created_at'],
    properties: {
      id: { type: 'string', pattern: '^usr_[0-9]+$' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      status: { type: 'string', enum: ['active', 'inactive'] },
      created_at: { type: 'integer' }
    }
  },

  products: {
    $id: 'product-catalog/products',
    type: 'object',
    required: ['id', 'name', 'price', 'currency', 'in_stock', 'department'],
    properties: {
      id: { type: 'string', pattern: '^prod_[0-9]+$' },
      name: { type: 'string' },
      price: { type: 'integer' },
      currency: { type: 'string' },
      in_stock: { type: 'boolean' },
      department: { type: 'string' }
    }
  },

  orders: {
    $id: 'order-service/orders',
    type: 'object',
    required: ['id', 'payment_id', 'amount', 'currency', 'status', 'created_at'],
    properties: {
      id: { type: 'string', pattern: '^ord_[a-z0-9]+$' },
      payment_id: { type: 'string' },
      amount: { type: 'integer' },
      currency: { type: 'string' },
      status: { type: 'string', enum: ['completed', 'pending', 'failed'] },
      created_at: { type: 'integer' }
    }
  },

  mcpTools: {
    $id: 'user-auth-mcp/tools',
    type: 'array',
    items: {
      type: 'object',
      required: ['tool', 'description', 'params', 'returns'],
      properties: {
        tool: { type: 'string' },
        description: { type: 'string' },
        params: { type: 'object' },
        returns: { type: 'object' }
      }
    }
  },

  webhookEvents: {
    $id: 'stripe-webhooks/events',
    type: 'array',
    items: {
      type: 'object',
      required: ['event', 'description', 'payload'],
      properties: {
        event: { type: 'string', enum: ['payment_success', 'payment_failed', 'refund_issued'] },
        description: { type: 'string' },
        payload: { type: 'object' }
      }
    }
  }
};

function getSchemaWithMutations(collection) {
  let schema = JSON.parse(JSON.stringify(baseSchemas[collection]));
  for (const id of getActiveMutations()) {
    const mutation = getMutation(id);
    if (mutation && mutation.target === collection) {
      schema = mutation.schemaTransform(schema);
    }
  }
  return schema;
}

router.get('/:service', (req, res) => {
  const serviceMap = {
    'users': 'users',
    'customer-directory': 'users',
    'products': 'products',
    'product-catalog': 'products',
    'orders': 'orders',
    'order-service': 'orders',
    'mcp': 'mcpTools',
    'mcp-tools': 'mcpTools',
    'user-auth-mcp': 'mcpTools',
    'webhooks': 'webhookEvents',
    'webhook-events': 'webhookEvents',
    'stripe-webhooks': 'webhookEvents'
  };

  const collection = serviceMap[req.params.service];
  if (!collection) {
    return res.status(404).json({ error: 'Unknown service', available: Object.keys(serviceMap) });
  }

  const schema = getSchemaWithMutations(collection);
  res.json({
    service: req.params.service,
    timestamp: new Date().toISOString(),
    schema
  });
});

router.get('/', (req, res) => {
  const schemas = {};
  for (const [key, schema] of Object.entries(baseSchemas)) {
    schemas[key] = getSchemaWithMutations(key);
  }
  res.json({ timestamp: new Date().toISOString(), schemas });
});

export default router;
