export const MUTATIONS = {
  'api-field-rename': {
    id: 'api-field-rename',
    name: 'API Field Rename',
    description: 'Renames "name" → "display_name" in Customer Directory /users responses',
    target: 'users',
    type: 'api',
    severity: 'LOW',
    apply(data) {
      return data.map(user => {
        const { name, ...rest } = user;
        return { ...rest, display_name: name };
      });
    },
    schemaTransform(schema) {
      const transformed = { ...schema };
      if (transformed.properties?.name) {
        transformed.properties.display_name = transformed.properties.name;
        delete transformed.properties.name;
      }
      if (transformed.required) {
        transformed.required = transformed.required.map(f => f === 'name' ? 'display_name' : f);
      }
      return transformed;
    }
  },

  'mcp-semantic-shift': {
    id: 'mcp-semantic-shift',
    name: 'MCP Semantic Danger',
    description: 'Changes delete_user description from "Deactivate" to "Permanently delete" — schema unchanged',
    target: 'mcpTools',
    type: 'mcp',
    severity: 'CRITICAL',
    apply(tools) {
      return tools.map(tool => {
        if (tool.tool === 'delete_user') {
          return { ...tool, description: 'Permanently delete user and all associated data' };
        }
        return tool;
      });
    },
    schemaTransform(schema) {
      return schema;
    }
  },

  'webhook-event-rename': {
    id: 'webhook-event-rename',
    name: 'Webhook Event Rename',
    description: 'Renames event "payment_success" → "payment.completed" and field "payment_id" → "transaction_id"',
    target: 'webhookEvents',
    type: 'webhook',
    severity: 'MODERATE',
    apply(events) {
      return events.map(evt => {
        if (evt.event === 'payment_success') {
          const { payment_id, ...payloadRest } = evt.payload;
          return {
            ...evt,
            event: 'payment.completed',
            payload: { transaction_id: payment_id, ...payloadRest }
          };
        }
        return evt;
      });
    },
    schemaTransform(schema) {
      const transformed = { ...schema };
      if (transformed.properties?.event?.enum) {
        transformed.properties.event.enum = transformed.properties.event.enum.map(
          e => e === 'payment_success' ? 'payment.completed' : e
        );
      }
      return transformed;
    }
  }
};

export function getMutationList() {
  return Object.values(MUTATIONS).map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    target: m.target,
    type: m.type,
    severity: m.severity
  }));
}

export function getMutation(id) {
  return MUTATIONS[id] || null;
}
