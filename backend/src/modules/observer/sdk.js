// SDK Observer — fetches latest version + metadata from package registries

const REGISTRY_URLS = {
  npm:    (pkg) => `https://registry.npmjs.org/${pkg}/latest`,
  pypi:   (pkg) => `https://pypi.org/pypi/${pkg}/json`,
  crates: (pkg) => `https://crates.io/api/v1/crates/${pkg}`,
  github: (pkg) => `https://api.github.com/repos/${pkg}/releases/latest`
};

const REGISTRY_PARSERS = {
  npm(json) {
    return {
      latestVersion: json.version,
      description: json.description || '',
      license: json.license || 'unknown',
      homepage: json.homepage || '',
      dependencies: Object.keys(json.dependencies || {}),
      deprecated: json.deprecated || false
    };
  },
  pypi(json) {
    const info = json.info || {};
    return {
      latestVersion: info.version,
      description: info.summary || '',
      license: info.license || 'unknown',
      homepage: info.home_page || info.project_url || '',
      dependencies: (info.requires_dist || []).map(d => d.split(' ')[0]),
      deprecated: false
    };
  },
  crates(json) {
    const c = json.crate || {};
    const newest = c.newest_version || c.max_version;
    return {
      latestVersion: newest,
      description: c.description || '',
      license: '',
      homepage: c.homepage || c.repository || '',
      dependencies: [],
      deprecated: false
    };
  },
  github(json) {
    const tag = json.tag_name || '';
    return {
      latestVersion: tag.replace(/^v/, ''),
      description: json.name || '',
      license: '',
      homepage: json.html_url || '',
      dependencies: [],
      deprecated: false
    };
  }
};

export async function observeSdk(dependency) {
  const { registry, packageName, pinnedVersion, methods } = dependency;
  const urlBuilder = REGISTRY_URLS[registry];
  if (!urlBuilder) {
    return {
      dependencyId: dependency.id,
      type: 'sdk',
      success: false,
      error: `Unknown registry: ${registry}`
    };
  }

  const url = urlBuilder(packageName);
  const start = Date.now();

  try {
    const headers = {};
    if (registry === 'crates') {
      headers['User-Agent'] = 'rebase-engine/1.0';
    }

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return {
        dependencyId: dependency.id,
        type: 'sdk',
        success: false,
        error: `Registry returned ${res.status}`,
        metadata: { statusCode: res.status, latencyMs, observedAt: new Date().toISOString() }
      };
    }

    const json = await res.json();
    const parser = REGISTRY_PARSERS[registry];
    const parsed = parser(json);

    const versionDrift = pinnedVersion && parsed.latestVersion && pinnedVersion !== parsed.latestVersion;
    const majorDrift = versionDrift && isMajorBump(pinnedVersion, parsed.latestVersion);

    return {
      dependencyId: dependency.id,
      type: 'sdk',
      success: true,
      rawData: {
        packageName,
        registry,
        language: dependency.language,
        pinnedVersion,
        latestVersion: parsed.latestVersion,
        versionDrift,
        majorDrift,
        deprecated: parsed.deprecated,
        description: parsed.description,
        license: parsed.license,
        homepage: parsed.homepage,
        dependencyCount: parsed.dependencies.length,
        methods: methods || [],
        methodCount: (methods || []).length
      },
      metadata: {
        statusCode: res.status,
        latencyMs,
        registryUrl: url,
        observedAt: new Date().toISOString()
      }
    };
  } catch (err) {
    return {
      dependencyId: dependency.id,
      type: 'sdk',
      success: false,
      error: err.message,
      metadata: { latencyMs: Date.now() - start, observedAt: new Date().toISOString() }
    };
  }
}

function isMajorBump(pinned, latest) {
  const pMajor = parseInt(pinned.split('.')[0], 10);
  const lMajor = parseInt(latest.split('.')[0], 10);
  return !isNaN(pMajor) && !isNaN(lMajor) && lMajor > pMajor;
}
