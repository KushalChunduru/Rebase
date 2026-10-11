// Semantic AI Engine
// Structure: deterministic scoring
// Semantics: heuristic analysis (LLM swap point for production)

export async function analyzeSemantics(diffs, impactResult, baseline, current) {
  const schemaCompat = computeSchemaCompat(diffs);
  const semanticCompat = computeSemanticCompat(diffs);
  const risk = classifyRisk(schemaCompat, semanticCompat, diffs, impactResult);
  const classification = generateClassification(diffs, schemaCompat, semanticCompat, risk);
  const confidence = computeConfidence(diffs, schemaCompat, semanticCompat);

  return { schemaCompat, semanticCompat, risk, classification, confidence };
}

// ── Deterministic: schema compatibility from structural diffs ──

function computeSchemaCompat(diffs) {
  const schemaDiffs = diffs.filter(d => d.layer === 'schema');
  if (schemaDiffs.length === 0) return 100;

  let penalty = 0;
  for (const diff of schemaDiffs) {
    switch (diff.type) {
      case 'field-removed':    penalty += 15; break;
      case 'field-added':      penalty += 5;  break;
      case 'type-changed':     penalty += 25; break;
      case 'required-added':   penalty += 10; break;
      case 'required-removed': penalty += 5;  break;
      case 'enum-changed':     penalty += 10; break;
    }
  }

  return Math.max(0, 100 - penalty);
}

// ── Heuristic: semantic compatibility (LLM swap point) ──

function computeSemanticCompat(diffs) {
  const valueChanges = diffs.filter(d => d.type === 'value-changed');
  const fieldRemovals = diffs.filter(d => d.type === 'field-removed');
  const fieldAdditions = diffs.filter(d => d.type === 'field-added');

  if (valueChanges.length === 0 && fieldRemovals.length === 0) return 100;

  let score = 100;

  for (const vc of valueChanges) {
    if (isDescriptionField(vc.path)) {
      const dangerScore = detectDestructiveSemantics(vc.baseline, vc.current);
      score -= dangerScore;
    } else {
      score -= 5;
    }
  }

  const renamePairs = detectRenames(fieldRemovals, fieldAdditions);
  for (const pair of renamePairs) {
    score -= 5;
  }

  const unresolvedRemovals = fieldRemovals.filter(
    r => !renamePairs.some(p => p.removed === r.path)
  );
  for (const rem of unresolvedRemovals) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function isDescriptionField(path) {
  const field = path.replace(/^\[\d+\]\.?/, '');
  return field === 'description' || field.endsWith('.description');
}

const DESTRUCTIVE_KEYWORDS = [
  'permanently', 'delete', 'destroy', 'erase', 'purge', 'wipe',
  'irreversible', 'remove all', 'drop', 'terminate'
];

const SAFE_KEYWORDS = [
  'deactivate', 'disable', 'suspend', 'archive', 'soft delete',
  'mark as', 'set status', 'flag'
];

function detectDestructiveSemantics(baseline, current) {
  if (typeof baseline !== 'string' || typeof current !== 'string') return 5;

  const baselineLower = baseline.toLowerCase();
  const currentLower = current.toLowerCase();

  const baseWasSafe = SAFE_KEYWORDS.some(kw => baselineLower.includes(kw));
  const currentIsDestructive = DESTRUCTIVE_KEYWORDS.some(kw => currentLower.includes(kw));

  if (baseWasSafe && currentIsDestructive) return 88;

  const currentIsSafe = SAFE_KEYWORDS.some(kw => currentLower.includes(kw));
  const baseWasDestructive = DESTRUCTIVE_KEYWORDS.some(kw => baselineLower.includes(kw));

  if (baseWasDestructive && currentIsSafe) return 30;

  if (currentIsDestructive && !baseWasDestructive) return 60;

  return 10;
}

function detectRenames(removals, additions) {
  const pairs = [];
  const usedAdditions = new Set();

  for (const rem of removals) {
    if (rem.layer !== 'data') continue;
    for (const add of additions) {
      if (add.layer !== 'data' || usedAdditions.has(add.path)) continue;

      const remParent = rem.path.replace(/\.[^.]+$/, '');
      const addParent = add.path.replace(/\.[^.]+$/, '');
      if (remParent !== addParent) continue;

      const sameType = typeof rem.baseline === typeof add.current;
      const sameValue = JSON.stringify(rem.baseline) === JSON.stringify(add.current);

      if (sameType && sameValue) {
        pairs.push({ removed: rem.path, added: add.path, value: rem.baseline });
        usedAdditions.add(add.path);
        break;
      }
    }
  }
  return pairs;
}

// ── Risk classification ──

function classifyRisk(schemaCompat, semanticCompat, diffs, impactResult) {
  if (semanticCompat <= 20) return 'CRITICAL';
  if (impactResult.highestRisk === 'CRITICAL') return 'CRITICAL';

  if (semanticCompat <= 50 || schemaCompat <= 40) return 'HIGH';
  if (impactResult.highestRisk === 'HIGH' && schemaCompat <= 70) return 'HIGH';

  if (schemaCompat <= 70 || semanticCompat <= 80) return 'MODERATE';

  return 'LOW';
}

// ── Classification text ──

function generateClassification(diffs, schemaCompat, semanticCompat, risk) {
  const valueChanges = diffs.filter(d => d.type === 'value-changed');
  const fieldRemovals = diffs.filter(d => d.type === 'field-removed' && d.layer === 'schema');
  const fieldAdditions = diffs.filter(d => d.type === 'field-added' && d.layer === 'schema');

  if (risk === 'CRITICAL') {
    const descChanges = valueChanges.filter(vc => isDescriptionField(vc.path));
    if (descChanges.length > 0) {
      return `DESTRUCTIVE SEMANTIC CHANGE — Schema is structurally identical but operational meaning has fundamentally changed. "${descChanges[0].baseline}" → "${descChanges[0].current}". Auto-repair MUST be blocked.`;
    }
    return `Critical structural and semantic divergence detected. Schema compatibility ${schemaCompat}%, semantic compatibility ${semanticCompat}%. Manual review required.`;
  }

  if (fieldRemovals.length > 0 && fieldAdditions.length > 0) {
    const removedNames = fieldRemovals.map(d => d.path);
    const addedNames = fieldAdditions.map(d => d.path);
    if (removedNames.length === addedNames.length) {
      return `Semantic equivalent detected — "${removedNames.join(', ')}" renamed to "${addedNames.join(', ')}". Adapter bridge recommended.`;
    }
  }

  const eventChanges = valueChanges.filter(vc => vc.path.includes('event'));
  if (eventChanges.length > 0) {
    return `Event naming convention migration detected ("${eventChanges[0].baseline}" → "${eventChanges[0].current}"). Compatibility adapter recommended.`;
  }

  return `Structural changes detected — schema compatibility ${schemaCompat}%, semantic compatibility ${semanticCompat}%. Risk: ${risk}.`;
}

// ── Confidence ──

function computeConfidence(diffs, schemaCompat, semanticCompat) {
  let confidence = 85;

  if (diffs.length <= 3) confidence += 5;
  if (diffs.length > 10) confidence -= 10;

  const gap = Math.abs(schemaCompat - semanticCompat);
  if (gap > 50) confidence += 8;
  if (gap < 10) confidence += 3;

  if (semanticCompat <= 20 || semanticCompat >= 90) confidence += 5;

  return Math.min(99, Math.max(50, confidence));
}
