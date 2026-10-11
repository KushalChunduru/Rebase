import { Router } from 'express';
import { getBaseline, getActiveMutations, applyMcpEdits, setMcpToolEdit, clearMcpToolEdit, getMcpEdits, clearAllMcpEdits } from '../state.js';
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
  let tools = applyActiveMutations(getBaseline('mcpTools'));
  tools = applyMcpEdits(tools);
  res.json({
    service: 'user-auth-mcp',
    protocol: 'MCP/1.0',
    timestamp: new Date().toISOString(),
    tools
  });
});

router.put('/tools/:toolName', (req, res) => {
  const { toolName } = req.params;
  const { description } = req.body;
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid description' });
  }
  const tools = getBaseline('mcpTools');
  const tool = tools.find(t => t.tool === toolName);
  if (!tool) {
    return res.status(404).json({ error: `Tool not found: ${toolName}` });
  }
  setMcpToolEdit(toolName, description);
  res.json({ tool: toolName, description, updated: true });
});

router.delete('/tools/:toolName/edit', (req, res) => {
  clearMcpToolEdit(req.params.toolName);
  res.json({ tool: req.params.toolName, restored: true });
});

router.post('/tools/restore-all', (req, res) => {
  clearAllMcpEdits();
  res.json({ restored: true });
});

router.get('/edits', (req, res) => {
  res.json({ edits: getMcpEdits() });
});

export default router;
