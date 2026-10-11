// Deterministic impact analysis — maps detected diffs to affected downstream workflows

const WORKFLOW_REGISTRY = {
  'customer-directory': [
    { name: 'Checkout & Onboarding Pipeline', fields: ['name', 'email', 'status', 'billing_address'], critical: true },
    { name: 'User Profile Sync Daemon', fields: ['name', 'email', 'status', 'user_tier'], critical: false },
    { name: 'CRM Data Export', fields: ['name', 'email'], critical: false },
    { name: 'Notification Service', fields: ['email', 'name'], critical: false }
  ],
  'product-catalog': [
    { name: 'Storefront Product Display', fields: ['name', 'price', 'in_stock', 'department'], critical: true },
    { name: 'Inventory Sync Worker', fields: ['in_stock', 'id'], critical: false },
    { name: 'Search Index Pipeline', fields: ['name', 'department'], critical: false }
  ],
  'order-service': [
    { name: 'Order Fulfillment Pipeline', fields: ['status', 'payment_id', 'amount'], critical: true },
    { name: 'Revenue Dashboard Aggregator', fields: ['amount', 'currency', 'status'], critical: false },
    { name: 'Shipping Integration', fields: ['status', 'id'], critical: false }
  ],
  'user-auth-mcp': [
    { name: 'Admin User Management Panel', tools: ['delete_user', 'update_role'], critical: true },
    { name: 'Automated Account Cleanup', tools: ['delete_user'], critical: true },
    { name: 'Role-Based Access Control', tools: ['update_role', 'get_user'], critical: true }
  ],
  'stripe-webhooks': [
    { name: 'Payment Processing Pipeline', events: ['payment_success', 'payment_failed'], fields: ['payment_id', 'amount'], critical: true },
    { name: 'Invoice Generation Service', events: ['payment_success'], fields: ['payment_id', 'amount', 'currency'], critical: false },
    { name: 'Refund Reconciliation Worker', events: ['refund_issued'], fields: ['payment_id', 'refund_amount'], critical: false }
  ]
};

export function analyzeImpact(diffs, dependency) {
  const workflows = WORKFLOW_REGISTRY[dependency.id] || [];
  if (workflows.length === 0) {
    return { impacts: [], summary: 'No registered workflows for this dependency' };
  }

  const changedFields = extractChangedFields(diffs);
  const changedValues = extractChangedValues(diffs);
  const impacts = [];

  for (const workflow of workflows) {
    const affected = checkWorkflowAffected(workflow, changedFields, changedValues, diffs);
    if (!affected.hit) continue;

    const riskLevel = assessRisk(workflow, affected, diffs);
    impacts.push({
      workflow: workflow.name,
      riskLevel,
      critical: workflow.critical,
      affectedBy: affected.reasons,
      description: buildDescription(workflow, affected, riskLevel)
    });
  }

  impacts.sort((a, b) => riskOrder(b.riskLevel) - riskOrder(a.riskLevel));

  return {
    impacts,
    totalAffected: impacts.length,
    highestRisk: impacts[0]?.riskLevel || 'NONE',
    summary: impacts.length === 0
      ? 'No workflows affected by detected changes'
      : `${impacts.length} workflow(s) affected — highest risk: ${impacts[0].riskLevel}`
  };
}

function extractChangedFields(diffs) {
  const fields = new Set();
  for (const diff of diffs) {
    if (diff.type === 'field-removed' || diff.type === 'field-added') {
      const fieldName = diff.path.replace(/^\[\d+\]\.?/, '').split('.')[0];
      if (fieldName) fields.add(fieldName);
    }
    if (diff.type === 'type-changed' || diff.type === 'required-added' || diff.type === 'required-removed') {
      fields.add(diff.path);
    }
  }
  return fields;
}

function extractChangedValues(diffs) {
  const values = [];
  for (const diff of diffs) {
    if (diff.type === 'value-changed') {
      const fieldName = diff.path.replace(/^\[\d+\]\.?/, '').split('.')[0];
      values.push({ field: fieldName, path: diff.path, baseline: diff.baseline, current: diff.current });
    }
  }
  return values;
}

function checkWorkflowAffected(workflow, changedFields, changedValues, diffs) {
  const reasons = [];

  if (workflow.fields) {
    for (const f of workflow.fields) {
      if (changedFields.has(f)) reasons.push(`field "${f}" changed`);
    }
    for (const v of changedValues) {
      if (workflow.fields.includes(v.field)) reasons.push(`field "${v.field}" value changed`);
    }
  }

  if (workflow.tools) {
    for (const v of changedValues) {
      if (v.path.includes('description')) {
        const toolDiffs = diffs.filter(d => d.path === v.path);
        reasons.push(`tool description changed at ${v.path}`);
      }
    }
  }

  if (workflow.events) {
    for (const v of changedValues) {
      if (v.field === 'event') reasons.push(`event "${v.baseline}" renamed to "${v.current}"`);
    }
    for (const f of changedFields) {
      if (workflow.fields?.includes(f)) reasons.push(`payload field "${f}" changed`);
    }
  }

  return { hit: reasons.length > 0, reasons };
}

function assessRisk(workflow, affected, diffs) {
  const hasDescriptionChange = affected.reasons.some(r => r.includes('description changed'));
  if (hasDescriptionChange && workflow.critical) return 'CRITICAL';

  const hasFieldRemoval = diffs.some(d => d.type === 'field-removed' && d.layer === 'schema');
  if (hasFieldRemoval && workflow.critical) return 'HIGH';
  if (hasFieldRemoval) return 'MEDIUM';

  const hasEventRename = affected.reasons.some(r => r.includes('renamed'));
  if (hasEventRename && workflow.critical) return 'HIGH';
  if (hasEventRename) return 'MEDIUM';

  if (workflow.critical) return 'MEDIUM';
  return 'LOW';
}

function riskOrder(level) {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }[level] || 0;
}

function buildDescription(workflow, affected, riskLevel) {
  const reasons = affected.reasons.join(', ');
  if (riskLevel === 'CRITICAL') return `${workflow.name} is critically affected: ${reasons}. Operational semantics may have changed — manual review required.`;
  if (riskLevel === 'HIGH') return `${workflow.name} will break: ${reasons}. Existing parsers/handlers expect the original structure.`;
  if (riskLevel === 'MEDIUM') return `${workflow.name} may be affected: ${reasons}. Compatibility adapter recommended.`;
  return `${workflow.name} has low-risk exposure: ${reasons}. Likely compatible without changes.`;
}
