import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// In-memory cache: sdkId -> { data, fetchedAt }
const releaseCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Registry release fetchers ───

async function fetchNpmReleases(packageName, pinnedVersion) {
  const res = await fetch(`https://registry.npmjs.org/${packageName}`, {
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return { error: `npm returned ${res.status}` };
  const json = await res.json();

  const allVersions = Object.keys(json.versions || {});
  const times = json.time || {};
  const latest = json['dist-tags']?.latest;

  const newerVersions = allVersions
    .filter(v => !v.includes('-') && isNewer(pinnedVersion, v))
    .sort(compareSemver)
    .slice(-10);

  const releases = newerVersions.map(v => {
    const meta = json.versions[v] || {};
    return {
      version: v,
      date: times[v] || null,
      deprecated: meta.deprecated || false,
      description: meta.description || '',
      homepage: meta.homepage || json.homepage || '',
      repository: typeof meta.repository === 'string' ? meta.repository : meta.repository?.url || '',
      changelog: null,
      releaseNotes: meta.deprecated ? `DEPRECATED: ${meta.deprecated}` : null
    };
  });

  const repoUrl = extractRepoUrl(json.repository);
  let changelogUrl = null;
  let releasesUrl = null;
  if (repoUrl) {
    changelogUrl = `${repoUrl}/blob/main/CHANGELOG.md`;
    releasesUrl = `${repoUrl}/releases`;
  }

  // Try to fetch GitHub release notes for the latest version
  if (repoUrl && latest) {
    const ghReleases = await fetchGitHubReleaseNotes(repoUrl, newerVersions.slice(-5));
    for (const rel of releases) {
      const gh = ghReleases.find(g => g.version === rel.version);
      if (gh) rel.releaseNotes = gh.body;
    }
  }

  return {
    packageName,
    registry: 'npm',
    latest,
    pinnedVersion,
    releases,
    sourceUrls: { changelog: changelogUrl, releases: releasesUrl, homepage: json.homepage || '' }
  };
}

async function fetchPypiReleases(packageName, pinnedVersion) {
  const res = await fetch(`https://pypi.org/pypi/${packageName}/json`, {
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return { error: `PyPI returned ${res.status}` };
  const json = await res.json();

  const info = json.info || {};
  const allReleases = json.releases || {};
  const stableVersions = Object.keys(allReleases)
    .filter(v => !v.includes('a') && !v.includes('b') && !v.includes('rc') && !v.includes('dev'))
    .filter(v => isNewer(pinnedVersion, v))
    .sort(compareSemver)
    .slice(-10);

  const releases = stableVersions.map(v => {
    const files = allReleases[v] || [];
    const uploadDate = files[0]?.upload_time_iso_8601 || files[0]?.upload_time || null;
    const yanked = files.some(f => f.yanked);
    return {
      version: v,
      date: uploadDate,
      deprecated: yanked,
      description: '',
      releaseNotes: yanked ? 'This version has been yanked' : null
    };
  });

  const projectUrls = info.project_urls || {};
  const changelogUrl = projectUrls.Changelog || projectUrls.changelog || projectUrls.Changes || null;
  const releasesUrl = projectUrls.Release || projectUrls.Releases || null;

  const repoUrl = extractPypiRepoUrl(info);
  if (repoUrl) {
    const ghReleases = await fetchGitHubReleaseNotes(repoUrl, stableVersions.slice(-5));
    for (const rel of releases) {
      const gh = ghReleases.find(g => g.version === rel.version);
      if (gh) rel.releaseNotes = gh.body;
    }
  }

  return {
    packageName,
    registry: 'pypi',
    latest: info.version,
    pinnedVersion,
    releases,
    sourceUrls: {
      changelog: changelogUrl,
      releases: releasesUrl,
      homepage: info.home_page || info.project_url || ''
    }
  };
}

async function fetchCratesReleases(packageName, pinnedVersion) {
  const res = await fetch(`https://crates.io/api/v1/crates/${packageName}/versions`, {
    headers: { 'User-Agent': 'rebase-engine/1.0' },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return { error: `crates.io returned ${res.status}` };
  const json = await res.json();

  const versions = (json.versions || [])
    .filter(v => !v.num.includes('-') && !v.yanked && isNewer(pinnedVersion, v.num))
    .slice(0, 10);

  const releases = versions.map(v => ({
    version: v.num,
    date: v.created_at || v.updated_at || null,
    deprecated: v.yanked || false,
    description: '',
    releaseNotes: null
  }));

  const crateRes = await fetch(`https://crates.io/api/v1/crates/${packageName}`, {
    headers: { 'User-Agent': 'rebase-engine/1.0' },
    signal: AbortSignal.timeout(5000)
  }).catch(() => null);
  let repoUrl = '';
  if (crateRes?.ok) {
    const crateJson = await crateRes.json();
    repoUrl = crateJson.crate?.repository || '';
  }

  if (repoUrl) {
    const ghReleases = await fetchGitHubReleaseNotes(repoUrl, versions.map(v => v.num).slice(0, 5));
    for (const rel of releases) {
      const gh = ghReleases.find(g => g.version === rel.version);
      if (gh) rel.releaseNotes = gh.body;
    }
  }

  return {
    packageName,
    registry: 'crates',
    latest: versions[0]?.num || pinnedVersion,
    pinnedVersion,
    releases,
    sourceUrls: {
      changelog: repoUrl ? `${repoUrl}/blob/master/CHANGELOG.md` : null,
      releases: repoUrl ? `${repoUrl}/releases` : null,
      homepage: repoUrl
    }
  };
}

async function fetchGitHubReleasesForRepo(packageName, pinnedVersion) {
  const res = await fetch(`https://api.github.com/repos/${packageName}/releases?per_page=10`, {
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return { error: `GitHub returned ${res.status}` };
  const json = await res.json();

  const releases = json
    .filter(r => !r.prerelease && !r.draft)
    .map(r => ({
      version: (r.tag_name || '').replace(/^v/, ''),
      date: r.published_at || r.created_at,
      deprecated: false,
      description: r.name || '',
      releaseNotes: truncateNotes(r.body),
      htmlUrl: r.html_url
    }))
    .filter(r => isNewer(pinnedVersion, r.version));

  return {
    packageName,
    registry: 'github',
    latest: releases[0]?.version || pinnedVersion,
    pinnedVersion,
    releases: releases.slice(0, 10),
    sourceUrls: {
      releases: `https://github.com/${packageName}/releases`,
      homepage: `https://github.com/${packageName}`
    }
  };
}

async function fetchGitHubReleaseNotes(repoUrl, versions) {
  const match = repoUrl.replace(/\.git$/, '').match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) return [];

  const repo = match[1];
  const results = [];
  for (const ver of versions) {
    for (const tag of [`v${ver}`, ver]) {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          const data = await res.json();
          results.push({ version: ver, body: truncateNotes(data.body) });
          break;
        }
      } catch { /* skip */ }
    }
  }
  return results;
}

// ─── Project code scanner ───

function scanProjectUsage(sdk) {
  const results = {
    installed: false,
    installedVersion: null,
    declaredVersion: null,
    imports: [],
    methodUsages: [],
    configUsages: [],
    files: []
  };

  // Check package.json files
  for (const pkgPath of ['package.json', 'backend/package.json']) {
    const full = path.join(PROJECT_ROOT, pkgPath);
    try {
      const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps[sdk.packageName]) {
        results.installed = true;
        results.declaredVersion = deps[sdk.packageName];
      }
    } catch { /* skip */ }
  }

  // Check lock files for exact installed version
  for (const lockPath of ['package-lock.json', 'backend/package-lock.json']) {
    const full = path.join(PROJECT_ROOT, lockPath);
    try {
      const lock = JSON.parse(fs.readFileSync(full, 'utf8'));
      const pkgEntry = lock.packages?.[`node_modules/${sdk.packageName}`]
        || lock.dependencies?.[sdk.packageName];
      if (pkgEntry?.version) {
        results.installedVersion = pkgEntry.version;
        results.installed = true;
      }
    } catch { /* skip */ }
  }

  // Scan source files for imports and usage
  const scanDirs = ['src', 'backend/src', 'scripts'];
  for (const dir of scanDirs) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    try {
      scanDirectory(fullDir, sdk, results, dir);
    } catch { /* skip */ }
  }

  return results;
}

function scanDirectory(dirPath, sdk, results, relativeBase) {
  let entries;
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return; }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      scanDirectory(fullPath, sdk, results, relativeBase);
    } else if (entry.isFile() && /\.(js|ts|mjs|cjs)$/.test(entry.name)) {
      scanFile(fullPath, sdk, results, relativeBase);
    }
  }
}

function scanFile(filePath, sdk, results, relativeBase) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }

  const relativePath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
  const lines = content.split('\n');

  // Check for imports of this package
  const importPatterns = [
    new RegExp(`import\\s+.*from\\s+['"]${escapeRegex(sdk.packageName)}['"]`, 'g'),
    new RegExp(`import\\s+['"]${escapeRegex(sdk.packageName)}['"]`, 'g'),
    new RegExp(`require\\s*\\(\\s*['"]${escapeRegex(sdk.packageName)}['"]\\s*\\)`, 'g')
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(lines[i])) {
        results.imports.push({
          file: relativePath,
          line: i + 1,
          statement: lines[i].trim()
        });
        if (!results.files.includes(relativePath)) results.files.push(relativePath);
      }
    }
  }

  // Check for method usage from tracked methods
  for (const method of (sdk.methods || [])) {
    const parts = method.split('.');
    const methodName = parts[parts.length - 1];
    const objectName = parts.length > 1 ? parts[parts.length - 2] : null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match patterns like: rzp.orders.create, Razorpay.orders.create, .methodName(
      if (objectName) {
        const pattern = new RegExp(`\\.${escapeRegex(objectName)}\\.${escapeRegex(methodName)}\\s*\\(`, 'g');
        if (pattern.test(line)) {
          results.methodUsages.push({
            method,
            file: relativePath,
            line: i + 1,
            context: line.trim().substring(0, 120)
          });
          if (!results.files.includes(relativePath)) results.files.push(relativePath);
        }
      } else {
        const pattern = new RegExp(`\\.${escapeRegex(methodName)}\\s*\\(`, 'g');
        if (pattern.test(line)) {
          results.methodUsages.push({
            method,
            file: relativePath,
            line: i + 1,
            context: line.trim().substring(0, 120)
          });
          if (!results.files.includes(relativePath)) results.files.push(relativePath);
        }
      }
    }
  }
}

// ─── Release change analyzer ───

function analyzeReleaseChanges(releaseData, projectUsage, sdk) {
  const findings = [];

  if (!releaseData || releaseData.error) {
    return { findings, error: releaseData?.error || 'No release data' };
  }

  for (const release of releaseData.releases) {
    const notes = release.releaseNotes || '';
    const changes = extractChangesFromNotes(notes, sdk);

    for (const change of changes) {
      const relevance = assessRelevance(change, projectUsage, sdk);
      findings.push({
        sdkId: sdk.id,
        sdkName: sdk.name,
        packageName: sdk.packageName,
        pinnedVersion: sdk.pinnedVersion,
        installedVersion: projectUsage.installedVersion || sdk.pinnedVersion,
        newVersion: release.version,
        releaseDate: release.date,
        category: change.category,
        summary: change.summary,
        detail: change.detail,
        upstreamEvidence: change.evidence,
        sourceUrl: releaseData.sourceUrls?.releases || releaseData.sourceUrls?.changelog || null,
        relevance: relevance.status,
        impact: change.impact,
        reason: relevance.reason,
        affectedFile: relevance.file || null,
        affectedLine: relevance.line || null,
        affectedMethod: relevance.method || null,
        usagePattern: relevance.usagePattern || null,
        recommendation: generateRecommendation(change, relevance, sdk),
        migrationSnippet: change.snippet || null,
        upgradeRisk: assessUpgradeRisk(release, releaseData, sdk)
      });
    }

    // If release has no parsed changes but has notes, add a summary finding
    if (changes.length === 0 && notes && notes.length > 20) {
      const isInstalled = projectUsage.installed;
      findings.push({
        sdkId: sdk.id,
        sdkName: sdk.name,
        packageName: sdk.packageName,
        pinnedVersion: sdk.pinnedVersion,
        installedVersion: projectUsage.installedVersion || sdk.pinnedVersion,
        newVersion: release.version,
        releaseDate: release.date,
        category: 'release',
        summary: `Version ${release.version} released`,
        detail: notes.substring(0, 500),
        upstreamEvidence: notes.substring(0, 200),
        sourceUrl: releaseData.sourceUrls?.releases || null,
        relevance: isInstalled ? 'POTENTIALLY_RELEVANT' : 'NOT_RELEVANT',
        impact: isMajorBump(sdk.pinnedVersion, release.version) ? 'BREAKING' : 'FEATURE',
        reason: isInstalled
          ? 'Package is installed in this project'
          : 'Package is tracked but not installed in this project',
        affectedFile: null,
        affectedLine: null,
        affectedMethod: null,
        usagePattern: null,
        recommendation: isInstalled
          ? `Review release notes for v${release.version} before upgrading`
          : 'Monitor — this SDK is not currently installed',
        migrationSnippet: null,
        upgradeRisk: assessUpgradeRisk(release, releaseData, sdk)
      });
    }
  }

  // If no releases and no findings, note it
  if (findings.length === 0 && releaseData.releases.length === 0) {
    findings.push({
      sdkId: sdk.id,
      sdkName: sdk.name,
      packageName: sdk.packageName,
      pinnedVersion: sdk.pinnedVersion,
      installedVersion: projectUsage.installedVersion || sdk.pinnedVersion,
      newVersion: releaseData.latest || sdk.pinnedVersion,
      releaseDate: null,
      category: 'info',
      summary: 'No newer releases found',
      detail: 'The pinned version matches the latest available, or no release data is available.',
      upstreamEvidence: null,
      sourceUrl: null,
      relevance: 'NOT_RELEVANT',
      impact: null,
      reason: 'Already up to date',
      affectedFile: null,
      affectedLine: null,
      affectedMethod: null,
      usagePattern: null,
      recommendation: 'No action needed',
      migrationSnippet: null,
      upgradeRisk: 'NONE'
    });
  }

  // Sort: RELEVANT first, then by impact severity
  const impactOrder = { BREAKING: 0, SECURITY: 1, DEPRECATION: 2, COMPATIBILITY: 3, BUGFIX: 4, FEATURE: 5, PERFORMANCE: 6 };
  const relevanceOrder = { RELEVANT: 0, POTENTIALLY_RELEVANT: 1, UNKNOWN: 2, NOT_RELEVANT: 3 };
  findings.sort((a, b) => {
    const rDiff = (relevanceOrder[a.relevance] ?? 9) - (relevanceOrder[b.relevance] ?? 9);
    if (rDiff !== 0) return rDiff;
    return (impactOrder[a.impact] ?? 9) - (impactOrder[b.impact] ?? 9);
  });

  return {
    findings,
    summary: {
      total: findings.length,
      relevant: findings.filter(f => f.relevance === 'RELEVANT').length,
      potentiallyRelevant: findings.filter(f => f.relevance === 'POTENTIALLY_RELEVANT').length,
      breaking: findings.filter(f => f.impact === 'BREAKING').length,
      security: findings.filter(f => f.impact === 'SECURITY').length,
      deprecations: findings.filter(f => f.impact === 'DEPRECATION').length,
      features: findings.filter(f => f.impact === 'FEATURE').length
    },
    projectUsage: {
      installed: projectUsage.installed,
      installedVersion: projectUsage.installedVersion,
      declaredVersion: projectUsage.declaredVersion,
      importCount: projectUsage.imports.length,
      methodUsageCount: projectUsage.methodUsages.length,
      files: projectUsage.files
    },
    sourceUrls: releaseData.sourceUrls,
    analyzedAt: new Date().toISOString()
  };
}

// ─── Change extraction from release notes ───

function extractChangesFromNotes(notes, sdk) {
  if (!notes || notes.length < 10) return [];

  const changes = [];
  const lines = notes.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const cleanLine = line.replace(/^[\s*\-•>#]+/, '').trim();
    if (cleanLine.length < 10) continue;

    const category = categorizeChange(cleanLine);
    if (!category) continue;

    const impact = classifyImpact(cleanLine, category);
    const snippet = extractSnippet(cleanLine);

    changes.push({
      category,
      impact,
      summary: cleanLine.substring(0, 200),
      detail: cleanLine,
      evidence: cleanLine,
      snippet
    });
  }

  return deduplicateChanges(changes);
}

function categorizeChange(text) {
  const lower = text.toLowerCase();

  if (/\bbreak(s|ing)?\b/i.test(text) || /\bremov(e|ed|ing)\b.*\b(method|function|api|param)/i.test(text))
    return 'breaking';
  if (/\bsecur(e|ity)\b/i.test(text) || /\bcve[\s-]/i.test(text) || /\bvulnerabilit/i.test(text))
    return 'security';
  if (/\bdeprecat(e|ed|ion|ing)\b/i.test(text))
    return 'deprecation';
  if (/\bfix(e[ds])?\b/i.test(text) || /\bbug\s*fix/i.test(text) || /\bpatch/i.test(text))
    return 'bugfix';
  if (/\bperform(ance)?\b/i.test(text) || /\boptimi[zs]/i.test(text) || /\bfaster\b/i.test(text))
    return 'performance';
  if (/\badd(s|ed|ing)?\b/i.test(text) || /\bnew\b/i.test(text) || /\bfeat(ure)?\b/i.test(text) || /\bsupport\b/i.test(text))
    return 'feature';
  if (/\bcompat(ib|ible|ibility)\b/i.test(text) || /\bupgrad(e|ing)\b/i.test(text) || /\bmigrat(e|ion|ing)\b/i.test(text))
    return 'compatibility';
  if (/\bupdate/i.test(text) || /\bchang(e|ed|ing)\b/i.test(text) || /\brefactor/i.test(text))
    return 'change';

  // Skip non-change lines (headers, bullets with just version numbers, etc.)
  if (lower.length < 20) return null;
  return 'change';
}

function classifyImpact(text, category) {
  const map = {
    breaking: 'BREAKING',
    security: 'SECURITY',
    deprecation: 'DEPRECATION',
    compatibility: 'COMPATIBILITY',
    bugfix: 'BUGFIX',
    performance: 'PERFORMANCE',
    feature: 'FEATURE',
    change: 'FEATURE'
  };
  return map[category] || 'FEATURE';
}

function extractSnippet(text) {
  const codeMatch = text.match(/`([^`]+)`/);
  return codeMatch ? codeMatch[1] : null;
}

// ─── Relevance assessment ───

function assessRelevance(change, projectUsage, sdk) {
  if (!projectUsage.installed) {
    return {
      status: 'NOT_RELEVANT',
      reason: `${sdk.packageName} is not installed in this project — tracked as external monitoring target only`
    };
  }

  if (projectUsage.imports.length === 0) {
    return {
      status: 'UNKNOWN',
      reason: `${sdk.packageName} is declared in package.json but no import statements found in source code`
    };
  }

  const text = (change.summary + ' ' + (change.detail || '')).toLowerCase();

  // Check if any tracked method appears in the change description
  for (const usage of projectUsage.methodUsages) {
    const methodParts = usage.method.split('.');
    const methodName = methodParts[methodParts.length - 1].toLowerCase();
    const objectName = methodParts.length > 1 ? methodParts[methodParts.length - 2].toLowerCase() : '';

    if (text.includes(methodName) || (objectName && text.includes(objectName))) {
      return {
        status: 'RELEVANT',
        reason: `Change mentions "${usage.method}" which is used in ${usage.file}:${usage.line}`,
        file: usage.file,
        line: usage.line,
        method: usage.method,
        usagePattern: usage.context
      };
    }
  }

  // Check if any imported module name appears in change
  for (const imp of projectUsage.imports) {
    const importedName = imp.statement.match(/import\s+(\w+)/)?.[1]?.toLowerCase();
    if (importedName && text.includes(importedName)) {
      return {
        status: 'POTENTIALLY_RELEVANT',
        reason: `Change may affect the "${importedName}" import in ${imp.file}:${imp.line}`,
        file: imp.file,
        line: imp.line
      };
    }
  }

  // Breaking/security changes are always potentially relevant if the package is used
  if (change.impact === 'BREAKING' || change.impact === 'SECURITY') {
    return {
      status: 'POTENTIALLY_RELEVANT',
      reason: `${change.impact} change in a package this project imports (${projectUsage.files.join(', ')})`
    };
  }

  return {
    status: 'POTENTIALLY_RELEVANT',
    reason: `Package is used in this project but specific method match not detected`
  };
}

function generateRecommendation(change, relevance, sdk) {
  if (relevance.status === 'NOT_RELEVANT') {
    return 'No action needed — this SDK is not installed in the project';
  }

  if (change.impact === 'BREAKING' && relevance.status === 'RELEVANT') {
    return `REVIEW REQUIRED: Breaking change affects ${relevance.method || 'your code'} in ${relevance.file || 'project files'}. Read the migration guide before upgrading.`;
  }
  if (change.impact === 'SECURITY') {
    return `SECURITY: Review this fix and consider upgrading ${sdk.packageName}`;
  }
  if (change.impact === 'DEPRECATION' && relevance.status === 'RELEVANT') {
    return `Plan migration: ${relevance.method || 'affected API'} is deprecated. Check replacement in release notes.`;
  }
  if (change.impact === 'FEATURE' && relevance.status === 'RELEVANT') {
    return `New capability available that relates to your existing usage of ${relevance.method || sdk.packageName}`;
  }
  if (change.impact === 'BUGFIX' && relevance.status === 'RELEVANT') {
    return `Bug fix for functionality you use — consider upgrading`;
  }

  return `Review release notes for v${change.summary?.match(/\d+\.\d+/)?.[0] || 'latest'}`;
}

function assessUpgradeRisk(release, releaseData, sdk) {
  if (release.deprecated) return 'HIGH';
  if (isMajorBump(sdk.pinnedVersion, release.version)) return 'HIGH';
  if (isMinorBump(sdk.pinnedVersion, release.version)) return 'MODERATE';
  return 'LOW';
}

// ─── Public API ───

export async function fetchReleases(sdk) {
  const cached = releaseCache.get(sdk.id);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.data;
  }

  const fetchers = {
    npm: fetchNpmReleases,
    pypi: fetchPypiReleases,
    crates: fetchCratesReleases,
    github: fetchGitHubReleasesForRepo
  };

  const fetcher = fetchers[sdk.registry];
  if (!fetcher) return { error: `Unsupported registry: ${sdk.registry}` };

  const data = await fetcher(sdk.packageName, sdk.pinnedVersion);
  releaseCache.set(sdk.id, { data, fetchedAt: Date.now() });
  return data;
}

export async function analyzeRelease(sdk) {
  const releaseData = await fetchReleases(sdk);
  const projectUsage = scanProjectUsage(sdk);
  return analyzeReleaseChanges(releaseData, projectUsage, sdk);
}

export function getProjectUsage(sdk) {
  return scanProjectUsage(sdk);
}

export function clearReleaseCache(sdkId) {
  if (sdkId) releaseCache.delete(sdkId);
  else releaseCache.clear();
}

// ─── Helpers ───

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractRepoUrl(repo) {
  if (!repo) return null;
  const url = typeof repo === 'string' ? repo : repo.url || '';
  return url.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^ssh:\/\/git@github\.com/, 'https://github.com');
}

function extractPypiRepoUrl(info) {
  const urls = info.project_urls || {};
  for (const key of ['Source', 'Repository', 'GitHub', 'Code', 'Homepage']) {
    if (urls[key] && urls[key].includes('github.com')) return urls[key];
  }
  if (info.home_page && info.home_page.includes('github.com')) return info.home_page;
  return null;
}

function truncateNotes(text) {
  if (!text) return null;
  return text.length > 2000 ? text.substring(0, 2000) + '...' : text;
}

function deduplicateChanges(changes) {
  const seen = new Set();
  return changes.filter(c => {
    const key = c.summary.substring(0, 80).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseSemver(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
}

function isNewer(pinned, candidate) {
  const a = parseSemver(pinned);
  const b = parseSemver(candidate);
  if (!a || !b) return String(candidate) !== String(pinned);
  return b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]) || (b[0] === a[0] && b[1] === a[1] && b[2] > a[2]);
}

function compareSemver(a, b) {
  const pa = parseSemver(a) || [0, 0, 0];
  const pb = parseSemver(b) || [0, 0, 0];
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}

function isMajorBump(pinned, latest) {
  const a = parseSemver(pinned);
  const b = parseSemver(latest);
  return a && b && b[0] > a[0];
}

function isMinorBump(pinned, latest) {
  const a = parseSemver(pinned);
  const b = parseSemver(latest);
  return a && b && b[0] === a[0] && b[1] > a[1];
}
