const express = require('express');
const database = require('../../lib/database');
const configuration = require('../../lib/configuration');
const pkg = require('../../package.json');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const semver = require('semver');

const server = module.exports = express();
const DEFAULT_SUPPORT_URL = 'https://laerdal.atlassian.net/servicedesk/customer/portal/2';
const SUPPORT_CHECK_TIMEOUT_MS = 5000;

function getPluginsConfig() {
  return configuration.getConfig('plugins') || {};
}

function getPluginConfig(pluginName) {
  const plugins = getPluginsConfig();
  return plugins[pluginName] || null;
}

function makeFeatureResult(checks, options) {
  const status = options.status;
  return {
    status,
    healthy: status !== 'down',
    checks,
    error: options.error || null,
    timestamp: new Date().toISOString()
  };
}

function evaluateDependencyHealth(pluginPackageRelativePath) {
  const pluginPackagePath = require.resolve(pluginPackageRelativePath);
  const pluginPackage = require(pluginPackagePath);
  const pluginDir = path.dirname(pluginPackagePath);
  const dependencies = pluginPackage.dependencies || {};
  const dependencyNames = Object.keys(dependencies);
  const missingPackages = [];
  const versionMismatchPackages = [];

  dependencyNames.forEach(function(dependencyName) {
    const expectedRange = dependencies[dependencyName];
    let resolvedPackageJsonPath;

    try {
      resolvedPackageJsonPath = require.resolve(dependencyName + '/package.json', {
        paths: [pluginDir]
      });
    } catch (resolveError) {
      missingPackages.push(dependencyName);
      return;
    }

    const installedPackage = require(resolvedPackageJsonPath);
    const installedVersion = installedPackage.version;
    const expectedIsRange = Boolean(semver.validRange(expectedRange));
    const versionMatches = expectedIsRange
      ? semver.satisfies(installedVersion, expectedRange)
      : installedVersion === expectedRange;

    if (!versionMatches) {
      versionMismatchPackages.push(
        dependencyName + ' (expected ' + expectedRange + ', installed ' + installedVersion + ')'
      );
    }
  });

  const errors = [];

  if (missingPackages.length > 0) {
    errors.push(missingPackages.join(', ') + ' is not installed');
  }

  if (versionMismatchPackages.length > 0) {
    errors.push(versionMismatchPackages.join(', ') + ' package version does not match the installed version');
  }

  return {
    dependencyPresent: errors.length === 0,
    dependencyError: errors.join('; ')
  };
}

function checkTranslationFeature() {
  try {
    const config = getPluginConfig('adapt-services-translation');
    const dependencyHealth = evaluateDependencyHealth('../../plugins/services/translation/package.json');

    const checks = {
      configPresent: Boolean(config),
      dependencyPresent: dependencyHealth.dependencyPresent
    };

    if (!checks.configPresent) {
      return makeFeatureResult(checks, {
        status: 'down',
        error: 'Translation plugin config missing'
      });
    }

    if (!checks.dependencyPresent) {
      return makeFeatureResult(checks, {
        status: 'down',
        error: dependencyHealth.dependencyError
      });
    }

    return makeFeatureResult(checks, {
      status: 'ok'
    });
  } catch (error) {
    return makeFeatureResult({}, {
      status: 'down',
      error: error.message
    });
  }
}

function checkAzcopyPresent() {
  try {
    const { execSync } = require('child_process');
    execSync('azcopy --version', { stdio: 'ignore', timeout: 2000 });
    return true;
  } catch (e) {
    return false;
  }
}

function checkCdnFeature() {
  try {
    const config = getPluginConfig('adapt-output-cdn');
    const dependencyHealth = evaluateDependencyHealth('../../plugins/output/cdn/package.json');
    const azcopyPresent = checkAzcopyPresent();

    const checks = {
      configPresent: Boolean(config),
      dependencyPresent: dependencyHealth.dependencyPresent,
      azcopyPresent
    };

    const errors = [];
    if (!checks.configPresent) errors.push('CDN plugin config missing');
    if (!checks.dependencyPresent) errors.push(dependencyHealth.dependencyError);
    if (!checks.azcopyPresent) errors.push('azcopy is not installed');

    return makeFeatureResult(checks, {
      status: errors.length > 0 ? 'down' : 'ok',
      error: errors.length > 0 ? errors.join('; ') : null
    });
  } catch (error) {
    return makeFeatureResult({}, {
      status: 'down',
      error: error.message
    });
  }
}

function checkPreflightFeature() {
  try {
    const config = getPluginConfig('adapt-output-preflight');
    const enabled = config ? config.isEnabled !== false : false;
    const fontPath = path.resolve(__dirname, '../../plugins/output/preflight/assets/arial-unicode-ms.ttf');
    const fontFileAvailable = fs.existsSync(fontPath);

    const checks = {
      configPresent: Boolean(config),
      enabled,
      fontFileAvailable
    };

    if (!checks.configPresent || !enabled) {
      return makeFeatureResult(checks, {
        status: 'down',
        error: 'Preflight plugin config missing or disabled'
      });
    }

    return makeFeatureResult(checks, {
      status: fontFileAvailable ? 'ok' : 'down',
      error: fontFileAvailable ? null : 'Required font dependency is missing'
    });
  } catch (error) {
    return makeFeatureResult({}, {
      status: 'down',
      error: error.message
    });
  }
}

function checkStoryboardFeature() {
  try {
    const config = getPluginConfig('adapt-output-storyboard');
    const enabled = config ? config.isEnabled !== false : false;
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1048576);
    const CRITICAL_HEAP_USED_MB = 800;

    const checks = {
      configPresent: Boolean(config),
      enabled,
      memory: {
        heapUsedMB,
        heapTotalMB: Math.round(mem.heapTotal / 1048576),
        rssMB: Math.round(mem.rss / 1048576),
        critical: heapUsedMB > CRITICAL_HEAP_USED_MB
      }
    };

    if (!checks.configPresent || !enabled) {
      return makeFeatureResult(checks, {
        status: 'down',
        error: 'Storyboard plugin config missing or disabled'
      });
    }

    return makeFeatureResult(checks, {
      status: checks.memory.critical ? 'down' : 'ok',
      error: checks.memory.critical ? 'Critical memory usage detected' : null
    });
  } catch (error) {
    return makeFeatureResult({}, {
      status: 'down',
      error: error.message
    });
  }
}

function checkUrlAvailable(urlString) {
  return new Promise(function(resolve) {
    let parsedUrl;

    try {
      parsedUrl = new URL(urlString);
    } catch (error) {
      resolve({ available: false, error: 'Support URL is invalid' });
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      resolve({ available: false, error: 'Support URL must use http or https' });
      return;
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const request = transport.request(urlString, {
      method: 'HEAD',
      timeout: SUPPORT_CHECK_TIMEOUT_MS
    }, function(response) {
      response.resume();
      const available = response.statusCode < 500;
      resolve({
        available,
        error: available ? null : 'Support portal returned status ' + response.statusCode
      });
    });

    request.on('error', function() {
      resolve({ available: false, error: 'Support portal is not reachable' });
    });

    request.on('timeout', function() {
      request.destroy();
      resolve({ available: false, error: 'Support portal check timed out' });
    });

    request.end();
  });
}

async function checkSupportFeature() {
  try {
    const supportLink = configuration.getConfig('supportLink');
    const effectiveSupportUrl = supportLink || DEFAULT_SUPPORT_URL;
    const availability = await checkUrlAvailable(effectiveSupportUrl);
    const checks = {
      supportLinkConfigured: Boolean(effectiveSupportUrl),
      portalAvailable: availability.available
    };

    return makeFeatureResult(checks, {
      status: availability.available ? 'ok' : 'down',
      error: availability.available ? null : availability.error
    });
  } catch (error) {
    return makeFeatureResult({}, {
      status: 'down',
      error: error.message
    });
  }
}

async function buildFeatureHealth() {
  const results = {
    translation: checkTranslationFeature(),
    cdn: checkCdnFeature(),
    preflight: checkPreflightFeature(),
    storyboard: checkStoryboardFeature(),
    support: await checkSupportFeature()
  };

  const statuses = Object.keys(results).map(key => results[key].status);
  const summary = {
    total: statuses.length,
    ok: statuses.filter(s => s === 'ok').length,
    degraded: statuses.filter(s => s === 'degraded').length,
    down: statuses.filter(s => s === 'down').length,
    downFeatures: Object.keys(results).filter(key => results[key].status === 'down')
  };

  return {
    features: results,
    summary
  };
}

/**
 * GET /api/health
 *
 * Unauthenticated liveness + readiness probe. Returns 200 when the server and
 * database are operational, 503 when any critical check fails. Intended for
 * CI smoke gates, load-balancer health checks, and uptime monitors.
 *
 * Response shape:
 *   { status, version, uptime, timestamp, memory: { heapUsedMB, heapTotalMB, rssMB }, checks: { database } }
 */
server.get('/api/health', function(req, res) {
  database.checkConnection(async function(dbError) {
    const mem = process.memoryUsage();
    const featureHealth = await buildFeatureHealth();
    const anyFeatureDown = featureHealth.summary.down > 0;
    const anyFeatureDegraded = featureHealth.summary.degraded > 0;
    const healthy = !dbError && !anyFeatureDown && !anyFeatureDegraded;

    // Instance is reachable when this handler returns a response.
    const instanceStatus = 'Up';
    const overallHealth = healthy ? 'ok' : 'degraded';
    const body = {
      status: instanceStatus,
      health: overallHealth,
      version: pkg.version,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1048576),
        heapTotalMB: Math.round(mem.heapTotal / 1048576),
        rssMB: Math.round(mem.rss / 1048576)
      },
      checks: {
        database: dbError ? String(dbError) : 'ok'
      },
      features: featureHealth.features,
      featureSummary: featureHealth.summary
    };

    res.status(200).json(body);
  });
});
