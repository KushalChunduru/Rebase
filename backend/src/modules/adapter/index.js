// Generates compatibility adapters based on detected diffs and semantic analysis
// CRITICAL risk → no adapter generated (blocked for human review)

export function generateAdapter(diffs, semanticResult, dependency) {
  if (semanticResult.risk === 'CRITICAL') {
    return {
      generated: false,
      reason: 'BLOCKED — Semantic risk is CRITICAL. Adapter generation refused for safety.',
      risk: 'CRITICAL'
    };
  }

  const mappings = buildMappings(diffs);
  if (mappings.length === 0) {
    return {
      generated: false,
      reason: 'No actionable field or event mappings found in diffs',
      risk: semanticResult.risk
    };
  }

  const adapterCode = generateCode(mappings, dependency);
  const adapterName = `adapt${toPascalCase(dependency.id)}Response`;

  return {
    generated: true,
    adapterName,
    type: mappings.some(m => m.kind === 'event') ? 'event-adapter' : 'field-adapter',
    mappings,
    adapterCode,
    risk: semanticResult.risk
  };
}

function buildMappings(diffs) {
  const mappings = [];
  const fieldRemovals = diffs.filter(d => d.type === 'field-removed');
  const fieldAdditions = diffs.filter(d => d.type === 'field-added');

  const usedAdds = new Set();
  for (const rem of fieldRemovals) {
    for (const add of fieldAdditions) {
      if (usedAdds.has(add.path)) continue;

      const remParent = parentPath(rem.path);
      const addParent = parentPath(add.path);
      if (remParent !== addParent) continue;

      const sameValue = JSON.stringify(rem.baseline) === JSON.stringify(add.current);
      if (sameValue) {
        mappings.push({
          kind: 'field-rename',
          from: fieldName(add.path),
          to: fieldName(rem.path),
          layer: rem.layer
        });
        usedAdds.add(add.path);
        break;
      }
    }
  }

  for (const diff of diffs) {
    if (diff.type === 'value-changed' && fieldName(diff.path) === 'event') {
      mappings.push({
        kind: 'event',
        from: diff.current,
        to: diff.baseline
      });
    }
  }

  return dedup(mappings);
}

function generateCode(mappings, dependency) {
  const lines = [];
  const fnName = `adapt${toPascalCase(dependency.id)}Response`;

  lines.push(`// Auto-generated adapter — ${dependency.name}`);
  lines.push(`function ${fnName}(response) {`);

  const fieldRenames = mappings.filter(m => m.kind === 'field-rename');
  const eventMaps = mappings.filter(m => m.kind === 'event');

  if (fieldRenames.length > 0) {
    lines.push(`  // Field mappings`);
    for (const m of fieldRenames) {
      lines.push(`  if (response.${m.from} !== undefined && response.${m.to} === undefined) {`);
      lines.push(`    response.${m.to} = response.${m.from};`);
      lines.push(`  }`);
    }
  }

  if (eventMaps.length > 0) {
    lines.push(`  // Event name mappings`);
    for (const m of eventMaps) {
      lines.push(`  if (response.event === "${m.from}") {`);
      lines.push(`    response.event = "${m.to}";`);
      lines.push(`  }`);
    }
  }

  lines.push(`  return response;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`module.exports = { ${fnName} };`);

  return lines.join('\n');
}

function parentPath(path) {
  const parts = path.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : '';
}

function fieldName(path) {
  return path.split('.').pop().replace(/^\[\d+\]\.?/, '');
}

function toPascalCase(str) {
  return str.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
}

function dedup(mappings) {
  const seen = new Set();
  return mappings.filter(m => {
    const key = `${m.kind}:${m.from}:${m.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
