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

  const schemaRemovals = schemaDiffs.filter(d => d.type === 'field-removed');
  const schemaAdditions = schemaDiffs.filter(d => d.type === 'field-added');
  const renamePairs = detectRenames(schemaRemovals, schemaAdditions);
  const renamedPaths = new Set([
    ...renamePairs.map(p => p.removed),
    ...renamePairs.map(p => p.added)
  ]);

  let penalty = 0;
  for (const diff of schemaDiffs) {
    if (renamedPaths.has(diff.path)) {
      penalty += 3;
      continue;
    }
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
  const uniqueRenames = new Set();
  for (const pair of renamePairs) {
    const key = stripIndices(pair.removed) + '→' + stripIndices(pair.added);
    uniqueRenames.add(key);
  }
  score -= uniqueRenames.size * 5;

  const unresolvedRemovals = fieldRemovals.filter(
    r => !renamePairs.some(p => p.removed === r.path)
  );
  const uniqueUnresolved = new Set(unresolvedRemovals.map(r => stripIndices(r.path)));
  score -= uniqueUnresolved.size * 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function stripIndices(path) {
  return path.replace(/\[\d+\]\./g, '');
}

function isDescriptionField(path) {
  const field = path.replace(/^\[\d+\]\.?/, '');
  return field === 'description' || field.endsWith('.description');
}

// Action verb categories — each word maps to an intent tier
// Tier scoring: read(0) < safe-write(1) < write(2) < admin(3) < destructive(4) < permanent-destructive(5)
const ACTION_VERBS = {
  // Tier 0: read-only
  get: 0, retrieve: 0, fetch: 0, read: 0, view: 0, list: 0, show: 0, display: 0,
  look: 0, check: 0, query: 0, search: 0, find: 0, lookup: 0, describe: 0, inspect: 0,
  // Tier 1: safe/reversible writes
  deactivate: 1, disable: 1, suspend: 1, archive: 1, flag: 1, tag: 1, mark: 1,
  pause: 1, mute: 1, hide: 1, lock: 1, block: 1, restrict: 1,
  // Tier 2: standard writes
  update: 2, modify: 2, edit: 2, change: 2, set: 2, assign: 2, configure: 2,
  create: 2, add: 2, insert: 2, send: 2, post: 2, submit: 2, write: 2, save: 2,
  enable: 2, activate: 2, unlock: 2, unblock: 2, restore: 2,
  // Tier 3: elevated / admin
  grant: 3, revoke: 3, escalate: 3, promote: 3, demote: 3, transfer: 3,
  override: 3, force: 3, impersonate: 3, approve: 3, reject: 3,
  // Tier 4: destructive
  delete: 4, remove: 4, drop: 4, clear: 4, reset: 4, uninstall: 4,
  cancel: 4, terminate: 4, destroy: 4, revoke: 4,
  // Tier 5: permanent/irreversible destructive
  permanently: 5, purge: 5, wipe: 5, erase: 5, nuke: 5, obliterate: 5
};

const SCOPE_AMPLIFIERS = [
  'all', 'every', 'entire', 'complete', 'batch', 'bulk', 'mass', 'recursive', 'cascade'
];

const IRREVERSIBILITY_MARKERS = [
  'permanently', 'irreversible', 'irreversibly', 'cannot be undone', 'no undo',
  'forever', 'cannot recover', 'unrecoverable', 'non-recoverable'
];

const DATA_SUBJECTS = [
  'data', 'records', 'history', 'logs', 'files', 'messages', 'credentials',
  'tokens', 'keys', 'secrets', 'permissions', 'roles', 'account', 'profile',
  'database', 'storage', 'backup', 'config', 'configuration'
];

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function detectActionTier(text) {
  const tokens = tokenize(text);
  let maxTier = -1;
  for (const token of tokens) {
    if (ACTION_VERBS[token] !== undefined && ACTION_VERBS[token] > maxTier) {
      maxTier = ACTION_VERBS[token];
    }
  }
  return maxTier;
}

function hasScope(text) {
  const lower = text.toLowerCase();
  return SCOPE_AMPLIFIERS.some(s => lower.includes(s));
}

function hasIrreversibility(text) {
  const lower = text.toLowerCase();
  return IRREVERSIBILITY_MARKERS.some(m => lower.includes(m));
}

function countDataSubjects(text) {
  const lower = text.toLowerCase();
  return DATA_SUBJECTS.filter(s => lower.includes(s)).length;
}

function computeWordOverlap(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  const common = [...setA].filter(w => setB.has(w) && w.length > 2);
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? common.length / union.size : 0;
}

function detectDestructiveSemantics(baseline, current) {
  if (typeof baseline !== 'string' || typeof current !== 'string') return 5;

  const baseTier = detectActionTier(baseline);
  const currTier = detectActionTier(current);
  const baseScope = hasScope(baseline);
  const currScope = hasScope(current);
  const baseIrrev = hasIrreversibility(baseline);
  const currIrrev = hasIrreversibility(current);
  const baseDataCount = countDataSubjects(baseline);
  const currDataCount = countDataSubjects(current);
  const overlap = computeWordOverlap(baseline, current);

  let penalty = 0;

  // Tier escalation: moving from a lower tier to a higher tier
  if (currTier > baseTier && baseTier >= 0) {
    const escalation = currTier - baseTier;
    if (escalation >= 4) penalty += 88;       // read → permanent-destructive
    else if (escalation >= 3) penalty += 75;  // read → destructive, safe → permanent
    else if (escalation >= 2) penalty += 55;  // read → write, safe → destructive
    else penalty += 30;                       // one-tier shift
  } else if (currTier > baseTier && baseTier < 0) {
    // baseline had no recognized action verb
    if (currTier >= 4) penalty += 65;
    else if (currTier >= 2) penalty += 35;
    else penalty += 15;
  } else if (currTier < baseTier && currTier >= 0) {
    // De-escalation (destructive → safe) is still a semantic change
    const drop = baseTier - currTier;
    penalty += Math.min(30, drop * 10);
  }

  // Scope amplification: narrow → broad
  if (currScope && !baseScope) penalty += 15;

  // Irreversibility added
  if (currIrrev && !baseIrrev) penalty += 20;

  // Data subject expansion
  if (currDataCount > baseDataCount) {
    penalty += Math.min(15, (currDataCount - baseDataCount) * 5);
  }

  // Dissimilarity: if the descriptions share very few words, the meaning shift is larger
  if (overlap < 0.15 && penalty > 0) penalty += 10;

  // Harmless rewrite: high overlap, same tier, no scope/irreversibility change
  if (overlap > 0.4 && currTier === baseTier && !currIrrev && !currScope) {
    penalty = Math.min(penalty, 8);
  }

  // No recognized verbs in either and high overlap → minor cosmetic change
  if (baseTier < 0 && currTier < 0 && overlap > 0.3) {
    penalty = Math.min(penalty, 5);
  }

  // Very low overlap with no recognized verbs in current → unknown intent, flag as risky
  if (currTier < 0 && baseTier >= 0 && overlap < 0.2) {
    penalty = Math.max(penalty, 50);
  }

  // Both have no recognized verbs but very different content → suspicious
  if (currTier < 0 && baseTier < 0 && overlap < 0.15) {
    penalty = Math.max(penalty, 40);
  }

  return Math.min(95, Math.max(0, penalty));
}

function detectRenames(removals, additions) {
  const pairs = [];
  const usedAdditions = new Set();

  for (const rem of removals) {
    for (const add of additions) {
      if (add.layer !== rem.layer || usedAdditions.has(add.path)) continue;

      const remParent = rem.path.includes('.') ? rem.path.replace(/\.[^.]+$/, '') : '';
      const addParent = add.path.includes('.') ? add.path.replace(/\.[^.]+$/, '') : '';
      if (remParent !== addParent) continue;

      const sameValue = JSON.stringify(rem.baseline) === JSON.stringify(add.current);
      const bothSameLayer = rem.layer === add.layer;

      if (sameValue || (bothSameLayer && rem.layer === 'schema')) {
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
  const descChanges = valueChanges.filter(vc => isDescriptionField(vc.path));

  if (descChanges.length > 0 && schemaCompat === 100) {
    const dc = descChanges[0];
    const baseTier = detectActionTier(dc.baseline);
    const currTier = detectActionTier(dc.current);

    if (risk === 'CRITICAL') {
      return `DESTRUCTIVE SEMANTIC CHANGE — Schema is structurally identical but operational meaning has fundamentally changed. "${dc.baseline}" → "${dc.current}". Auto-repair MUST be blocked.`;
    }
    if (risk === 'HIGH') {
      const direction = currTier > baseTier ? 'escalation' : 'shift';
      return `SEMANTIC ${direction.toUpperCase()} — Schema unchanged, but tool intent shifted significantly. "${dc.baseline}" → "${dc.current}". Schema compat ${schemaCompat}%, semantic compat ${semanticCompat}%. Human review recommended.`;
    }
    if (risk === 'MODERATE') {
      return `Semantic drift detected — tool description changed from "${dc.baseline}" to "${dc.current}". Schema compat ${schemaCompat}%, semantic compat ${semanticCompat}%. Review advised.`;
    }
    return `Minor description change — "${dc.baseline}" → "${dc.current}". Semantic compat ${semanticCompat}%, no structural impact. Low risk.`;
  }

  if (risk === 'CRITICAL') {
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
