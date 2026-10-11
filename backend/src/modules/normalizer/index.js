// Normalizes raw observations into a common DependencyObservation format
// Type-specific extraction logic lives here — everything downstream is type-agnostic

export function normalize(rawObservation) {
  if (!rawObservation.success) {
    return {
      dependencyId: rawObservation.dependencyId,
      type: rawObservation.type,
      success: false,
      error: rawObservation.error,
      metadata: rawObservation.metadata
    };
  }

  const extractor = extractors[rawObservation.type];
  if (!extractor) {
    throw new Error(`No normalizer for dependency type: ${rawObservation.type}`);
  }

  const { data, schema, service, version, endpoint } = extractor(rawObservation);

  return {
    dependencyId: rawObservation.dependencyId,
    type: rawObservation.type,
    success: true,
    data,
    schema: rawObservation.rawSchema || schema,
    metadata: {
      service,
      version,
      endpoint,
      statusCode: rawObservation.metadata.statusCode,
      latencyMs: rawObservation.metadata.latencyMs,
      observedAt: rawObservation.metadata.observedAt
    }
  };
}

const extractors = {
  api(raw) {
    const body = raw.rawData;
    return {
      data: body.data || body,
      schema: inferSchema(body.data?.[0] || body),
      service: body.service || raw.dependencyId,
      version: body.version || 'unknown',
      endpoint: body.endpoint || ''
    };
  },

  mcp(raw) {
    const body = raw.rawData;
    return {
      data: body.tools || body,
      schema: inferSchema(body.tools?.[0] || body),
      service: body.service || raw.dependencyId,
      version: body.protocol || 'unknown',
      endpoint: 'tools'
    };
  },

  webhook(raw) {
    const body = raw.rawData;
    return {
      data: body.events || body,
      schema: inferSchema(body.events?.[0] || body),
      service: body.service || raw.dependencyId,
      version: body.version || 'unknown',
      endpoint: 'events'
    };
  }
};

function inferSchema(sample) {
  if (!sample || typeof sample !== 'object') return null;
  const schema = { type: 'object', properties: {} };
  for (const [key, value] of Object.entries(sample)) {
    if (value === null) {
      schema.properties[key] = { type: 'null' };
    } else if (Array.isArray(value)) {
      schema.properties[key] = { type: 'array' };
    } else {
      schema.properties[key] = { type: typeof value };
    }
  }
  schema.required = Object.keys(sample);
  return schema;
}
