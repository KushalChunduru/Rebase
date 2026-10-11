// Safety Gate — final pipeline decision
// Policy from CLAUDE.md:
//   confidence >= 0.90 AND risk != CRITICAL AND sandbox passes → AUTO-APPLY
//   CRITICAL semantic changes → ALWAYS BLOCKED
//   Otherwise → HUMAN REVIEW

export function evaluateSafety(semanticResult, sandboxResult, adapterResult, pipelineConfig) {
  const { confidence, risk } = semanticResult;
  const threshold = pipelineConfig.autoApplyThreshold;

  if (risk === 'CRITICAL') {
    return {
      decision: 'blocked',
      reason: 'CRITICAL semantic risk — auto-repair blocked for safety',
      factors: buildFactors(semanticResult, sandboxResult, adapterResult),
      requiresHumanReview: true,
      autoApplyAllowed: false
    };
  }

  if (!adapterResult.generated) {
    return {
      decision: 'human-review',
      reason: 'No adapter was generated — manual intervention required',
      factors: buildFactors(semanticResult, sandboxResult, adapterResult),
      requiresHumanReview: true,
      autoApplyAllowed: false
    };
  }

  if (sandboxResult.skipped) {
    return {
      decision: 'human-review',
      reason: 'Sandbox validation was skipped — cannot auto-apply without validation',
      factors: buildFactors(semanticResult, sandboxResult, adapterResult),
      requiresHumanReview: true,
      autoApplyAllowed: false
    };
  }

  if (!sandboxResult.passed) {
    return {
      decision: 'human-review',
      reason: `Sandbox validation failed: ${sandboxResult.reason}`,
      factors: buildFactors(semanticResult, sandboxResult, adapterResult),
      requiresHumanReview: true,
      autoApplyAllowed: false
    };
  }

  const normalizedConfidence = confidence / 100;
  if (normalizedConfidence >= threshold && risk !== 'HIGH') {
    return {
      decision: 'auto-apply',
      reason: `Confidence ${confidence}% meets threshold (${threshold * 100}%), risk ${risk}, sandbox passed`,
      factors: buildFactors(semanticResult, sandboxResult, adapterResult),
      requiresHumanReview: false,
      autoApplyAllowed: true
    };
  }

  return {
    decision: 'human-review',
    reason: normalizedConfidence < threshold
      ? `Confidence ${confidence}% below threshold (${threshold * 100}%)`
      : `Risk level ${risk} requires human review`,
    factors: buildFactors(semanticResult, sandboxResult, adapterResult),
    requiresHumanReview: true,
    autoApplyAllowed: false
  };
}

function buildFactors(semanticResult, sandboxResult, adapterResult) {
  return {
    confidence: semanticResult.confidence,
    risk: semanticResult.risk,
    schemaCompat: semanticResult.schemaCompat,
    semanticCompat: semanticResult.semanticCompat,
    sandboxPassed: sandboxResult.passed,
    sandboxSkipped: sandboxResult.skipped || false,
    adapterGenerated: adapterResult.generated
  };
}
