import { Router } from 'express';
import { getBaseline, getActiveMutations } from '../state.js';
import { getMutation } from '../mutations.js';

const router = Router();

function applyActiveMutations(data) {
  let result = data;
  for (const id of getActiveMutations()) {
    const mutation = getMutation(id);
    if (mutation && mutation.target === 'mcpTools') {
      result = mutation.apply(result);
    }
  }
  return result;
}

router.get('/tools', (req, res) => {
  const tools = applyActiveMutations(getBaseline('mcpTools'));
  res.json({
    service: 'user-auth-mcp',
    protocol: 'MCP/1.0',
    timestamp: new Date().toISOString(),
    tools
  });
});

export default router;
