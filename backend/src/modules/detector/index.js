// Deterministic structural diff — no AI, pure comparison logic

export function detectChanges(baseline, current) {
  const diffs = [];

  diffSchemas(baseline.schema, current.schema, diffs);
  diffData(baseline.data, current.data, diffs);

  const changed = diffs.length > 0;
  const summary = changed
    ? diffs.map(d => formatDiff(d)).join('; ')
    : 'No changes detected';

  return { changed, diffs, summary };
}

function diffSchemas(baseSchema, currSchema, diffs) {
  if (!baseSchema || !currSchema) return;

  const baseProps = baseSchema.properties || {};
  const currProps = currSchema.properties || {};
  const baseRequired = new Set(baseSchema.required || []);
  const currRequired = new Set(currSchema.required || []);

  const baseKeys = new Set(Object.keys(baseProps));
  const currKeys = new Set(Object.keys(currProps));

  for (const key of baseKeys) {
    if (!currKeys.has(key)) {
      diffs.push({ type: 'field-removed', path: key, baseline: baseProps[key], current: null, layer: 'schema' });
    }
  }

  for (const key of currKeys) {
    if (!baseKeys.has(key)) {
      diffs.push({ type: 'field-added', path: key, baseline: null, current: currProps[key], layer: 'schema' });
    }
  }

  for (const key of baseKeys) {
    if (!currKeys.has(key)) continue;
    const bp = baseProps[key];
    const cp = currProps[key];
    if (bp.type !== cp.type) {
      diffs.push({ type: 'type-changed', path: key, baseline: bp.type, current: cp.type, layer: 'schema' });
    }
    if (JSON.stringify(bp.enum) !== JSON.stringify(cp.enum)) {
      diffs.push({ type: 'enum-changed', path: key, baselineEnum: bp.enum, currentEnum: cp.enum, layer: 'schema' });
    }
  }

  for (const key of baseRequired) {
    if (!currRequired.has(key) && currKeys.has(key)) {
      diffs.push({ type: 'required-removed', path: key, layer: 'schema' });
    }
  }
  for (const key of currRequired) {
    if (!baseRequired.has(key) && baseKeys.has(key)) {
      diffs.push({ type: 'required-added', path: key, layer: 'schema' });
    }
  }

  if (baseSchema.items && currSchema.items) {
    diffSchemas(baseSchema.items, currSchema.items, diffs);
  }
}

function diffData(baseData, currData, diffs) {
  if (!Array.isArray(baseData) || !Array.isArray(currData)) {
    diffObjects(baseData, currData, '', diffs);
    return;
  }

  const maxLen = Math.max(baseData.length, currData.length);
  for (let i = 0; i < maxLen; i++) {
    const prefix = `[${i}]`;
    if (i >= baseData.length) {
      diffs.push({ type: 'record-added', path: prefix, current: currData[i], layer: 'data' });
      continue;
    }
    if (i >= currData.length) {
      diffs.push({ type: 'record-removed', path: prefix, baseline: baseData[i], layer: 'data' });
      continue;
    }
    diffObjects(baseData[i], currData[i], prefix, diffs);
  }
}

function diffObjects(base, curr, prefix, diffs) {
  if (base === null || curr === null || typeof base !== 'object' || typeof curr !== 'object') {
    if (base !== curr) {
      diffs.push({ type: 'value-changed', path: prefix || '.', baseline: base, current: curr, layer: 'data' });
    }
    return;
  }

  const baseKeys = new Set(Object.keys(base));
  const currKeys = new Set(Object.keys(curr));

  for (const key of baseKeys) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (!currKeys.has(key)) {
      diffs.push({ type: 'field-removed', path: fullPath, baseline: base[key], current: null, layer: 'data' });
    } else if (typeof base[key] === 'object' && base[key] !== null && typeof curr[key] === 'object' && curr[key] !== null) {
      diffObjects(base[key], curr[key], fullPath, diffs);
    } else if (base[key] !== curr[key]) {
      diffs.push({ type: 'value-changed', path: fullPath, baseline: base[key], current: curr[key], layer: 'data' });
    }
  }

  for (const key of currKeys) {
    if (!baseKeys.has(key)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      diffs.push({ type: 'field-added', path: fullPath, baseline: null, current: curr[key], layer: 'data' });
    }
  }
}

function formatDiff(diff) {
  switch (diff.type) {
    case 'field-removed':  return `Field removed: "${diff.path}"`;
    case 'field-added':    return `Field added: "${diff.path}"`;
    case 'type-changed':   return `Type changed: "${diff.path}" (${diff.baseline} → ${diff.current})`;
    case 'value-changed':  return `Value changed: "${diff.path}"`;
    case 'enum-changed':   return `Enum changed: "${diff.path}"`;
    case 'required-added': return `Now required: "${diff.path}"`;
    case 'required-removed': return `No longer required: "${diff.path}"`;
    case 'record-added':   return `Record added at ${diff.path}`;
    case 'record-removed': return `Record removed at ${diff.path}`;
    default: return `${diff.type}: "${diff.path}"`;
  }
}
