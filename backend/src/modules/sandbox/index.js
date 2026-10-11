// Sandbox Validation — executes adapter code against current data in isolation
// and verifies the adapted output matches the baseline structure

export function validateAdapter(adapterResult, currentData, baselineData) {
  if (!adapterResult.generated) {
    return {
      passed: false,
      skipped: true,
      reason: adapterResult.reason || 'No adapter generated',
      tests: []
    };
  }

  const adapterFn = compileAdapter(adapterResult.adapterCode, adapterResult.adapterName);
  if (adapterFn.error) {
    return {
      passed: false,
      skipped: false,
      reason: `Adapter compilation failed: ${adapterFn.error}`,
      tests: [{ name: 'compile', passed: false, error: adapterFn.error }]
    };
  }

  const tests = [];
  const records = Array.isArray(currentData) ? currentData : [currentData];
  const baselineRecords = Array.isArray(baselineData) ? baselineData : [baselineData];

  tests.push(runCompileTest(adapterFn.fn));
  tests.push(runNoThrowTest(adapterFn.fn, records));
  tests.push(runFieldCoverageTest(adapterFn.fn, records, baselineRecords));
  tests.push(runIdempotencyTest(adapterFn.fn, records));
  tests.push(runNoDataLossTest(adapterFn.fn, records));

  const passed = tests.every(t => t.passed);

  return {
    passed,
    skipped: false,
    reason: passed ? 'All sandbox tests passed' : `${tests.filter(t => !t.passed).length} test(s) failed`,
    tests,
    recordsTested: records.length
  };
}

function compileAdapter(code, fnName) {
  try {
    const wrappedCode = code
      .replace(/module\.exports\s*=\s*\{[^}]*\};?/, '')
      .trim();

    const fn = new Function('record', `
      ${wrappedCode}
      return ${fnName}(record);
    `);

    return { fn, error: null };
  } catch (err) {
    return { fn: null, error: err.message };
  }
}

function runCompileTest(fn) {
  return {
    name: 'compile',
    passed: typeof fn === 'function',
    detail: 'Adapter code compiles without errors'
  };
}

function runNoThrowTest(fn, records) {
  const errors = [];
  for (let i = 0; i < records.length; i++) {
    try {
      const copy = JSON.parse(JSON.stringify(records[i]));
      fn(copy);
    } catch (err) {
      errors.push({ record: i, error: err.message });
    }
  }
  return {
    name: 'no-throw',
    passed: errors.length === 0,
    detail: errors.length === 0
      ? `Adapter executed on ${records.length} record(s) without throwing`
      : `Adapter threw on ${errors.length} record(s)`,
    errors: errors.length > 0 ? errors : undefined
  };
}

function runFieldCoverageTest(fn, currentRecords, baselineRecords) {
  const baselineFields = extractFields(baselineRecords);
  let coveredCount = 0;
  let missingFields = [];

  for (const record of currentRecords) {
    const copy = JSON.parse(JSON.stringify(record));
    try {
      const adapted = fn(copy);
      const adaptedFields = new Set(Object.keys(adapted || {}));
      for (const field of baselineFields) {
        if (adaptedFields.has(field)) coveredCount++;
        else if (!missingFields.includes(field)) missingFields.push(field);
      }
    } catch {
      // no-throw test catches this
    }
  }

  const totalChecks = baselineFields.size * currentRecords.length;
  const coverage = totalChecks > 0 ? Math.round((coveredCount / totalChecks) * 100) : 100;
  const passed = coverage >= 80;

  return {
    name: 'field-coverage',
    passed,
    detail: `${coverage}% of baseline fields present after adaptation`,
    coverage,
    missingFields: missingFields.length > 0 ? missingFields : undefined
  };
}

function runIdempotencyTest(fn, records) {
  let passed = true;
  for (const record of records) {
    try {
      const copy1 = JSON.parse(JSON.stringify(record));
      const once = fn(copy1);
      const copy2 = JSON.parse(JSON.stringify(once));
      const twice = fn(copy2);
      if (JSON.stringify(once) !== JSON.stringify(twice)) {
        passed = false;
        break;
      }
    } catch {
      passed = false;
      break;
    }
  }
  return {
    name: 'idempotency',
    passed,
    detail: passed
      ? 'Adapter produces same result when applied twice'
      : 'Adapter is not idempotent — double-application changes output'
  };
}

function runNoDataLossTest(fn, records) {
  let passed = true;
  let detail = '';
  for (const record of records) {
    try {
      const copy = JSON.parse(JSON.stringify(record));
      const originalKeys = Object.keys(copy);
      const adapted = fn(copy);
      const adaptedKeys = Object.keys(adapted || {});
      if (adaptedKeys.length < originalKeys.length - 1) {
        passed = false;
        detail = `Adapter removed ${originalKeys.length - adaptedKeys.length} fields — possible data loss`;
        break;
      }
    } catch {
      passed = false;
      detail = 'Adapter threw during data loss check';
      break;
    }
  }
  return {
    name: 'no-data-loss',
    passed,
    detail: passed ? 'No unexpected field removal detected' : detail
  };
}

function extractFields(records) {
  const fields = new Set();
  for (const record of records) {
    if (record && typeof record === 'object') {
      Object.keys(record).forEach(k => fields.add(k));
    }
  }
  return fields;
}
