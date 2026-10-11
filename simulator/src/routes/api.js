import { Router } from 'express';
import { getBaseline, getActiveMutations } from '../state.js';
import { getMutation } from '../mutations.js';

const router = Router();

function applyActiveMutations(collection, data) {
  let result = data;
  for (const id of getActiveMutations()) {
    const mutation = getMutation(id);
    if (mutation && mutation.target === collection) {
      result = mutation.apply(result);
    }
  }
  return result;
}

router.get('/users', (req, res) => {
  const data = applyActiveMutations('users', getBaseline('users'));
  res.json({
    service: 'customer-directory',
    version: 'v2',
    endpoint: 'GET /users',
    timestamp: new Date().toISOString(),
    data
  });
});

router.get('/products', (req, res) => {
  const data = getBaseline('products');
  res.json({
    service: 'product-catalog',
    version: 'v1',
    endpoint: 'GET /products',
    timestamp: new Date().toISOString(),
    data
  });
});

router.get('/orders', (req, res) => {
  const data = getBaseline('orders');
  res.json({
    service: 'order-service',
    version: 'v1',
    endpoint: 'GET /orders',
    timestamp: new Date().toISOString(),
    cursor: 'ord_cur_8921a',
    data
  });
});

export default router;
