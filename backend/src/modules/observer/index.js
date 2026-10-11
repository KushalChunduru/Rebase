// Observes external dependencies — fetches current data + schema
// Works for all types: api, mcp, webhook

const SCHEMA_PATH_MAP = {
  'customer-directory': 'customer-directory',
  'product-catalog':    'product-catalog',
  'order-service':      'order-service',
  'user-auth-mcp':      'user-auth-mcp',
  'stripe-webhooks':    'stripe-webhooks'
};

export async function observe(dependency) {
  const dataUrl = `${dependency.baseUrl}${dependency.path}`;
  const start = Date.now();

  const dataResponse = await fetch(dataUrl);
  const latencyMs = Date.now() - start;

  if (!dataResponse.ok) {
    return {
      dependencyId: dependency.id,
      type: dependency.type,
      success: false,
      error: `HTTP ${dataResponse.status} ${dataResponse.statusText}`,
      metadata: { statusCode: dataResponse.status, latencyMs, observedAt: new Date().toISOString() }
    };
  }

  const rawData = await dataResponse.json();
  const headers = Object.fromEntries(dataResponse.headers.entries());

  let rawSchema = null;
  const schemaKey = SCHEMA_PATH_MAP[dependency.id];
  if (schemaKey) {
    const schemaUrl = `${dependency.baseUrl}/schema/${schemaKey}`;
    try {
      const schemaRes = await fetch(schemaUrl);
      if (schemaRes.ok) {
        const schemaBody = await schemaRes.json();
        rawSchema = schemaBody.schema || schemaBody;
      }
    } catch {}
  }

  return {
    dependencyId: dependency.id,
    type: dependency.type,
    success: true,
    rawData,
    rawSchema,
    metadata: {
      statusCode: dataResponse.status,
      latencyMs,
      headers,
      dataUrl,
      observedAt: new Date().toISOString()
    }
  };
}
