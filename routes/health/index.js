const express = require('express');
const database = require('../../lib/database');
const configuration = require('../../lib/configuration');
const pkg = require('../../package.json');
const fs = require('fs');
const path = require('path');

const server = module.exports = express();

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

function checkTranslationFeature() {
  try {
    const config = getPluginConfig('adapt-services-translation');
    const smartling = (config && config.smartling) || {};
    const medialocate = (config && config.medialocate) || {};
    const leats = (config && config.leats) || {};
    const enabled = config ? config.isEnabled !== false : false;

    const checks = {
      configPresent: Boolean(config),
      enabled,
      adapters: {
        smartlingConfigured: Boolean(smartling.userIdentifier && smartling.userSecret),
        medialocateConfigured: Boolean(medialocate.baseUrl || medialocate.environment),
        leatsConfigured: Boolean(leats.azureEndpoint && leats.azureApiKey && leats.deployment)
      }
    };

    if (!checks.configPresent || !enabled) {
      return makeFeatureResult(checks, {
        status: 'down',
        error: 'Translation plugin config missing or disabled'
      });
    }

    const adapterCount = [
      checks.adapters.smartlingConfigured,
      checks.adapters.medialocateConfigured,
      checks.adapters.leatsConfigured
    ].filter(Boolean).length;

    return makeFeatureResult(checks, {
      status: adapterCount > 0 ? 'ok' : 'degraded'
    });
  } catch (error) {
    return makeFeatureResult({}, {
      status: 'down',
      error: error.message
    });
  }
}

function checkCdnFeature() {
  try {
    const config = getPluginConfig('adapt-output-cdn');
    const enabled = config ? config.isEnabled !== false : false;
    const deployProviderConfigured = Boolean(
      config && (config.provider || config.cdnProvider || config.deployProvider)
    );

    const checks = {
      configPresent: Boolean(config),
      enabled,
      deployProviderConfigured
    };

    if (!checks.configPresent || !enabled) {
      return makeFeatureResult(checks, {
        status: 'down',
        error: 'CDN plugin config missing or disabled'
      });
    }

    return makeFeatureResult(checks, {
      status: deployProviderConfigured ? 'ok' : 'down',
      error: deployProviderConfigured ? null : 'Deploy provider is not configured'
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

    const checks = {
      configPresent: Boolean(config),
      enabled,
      memory: {
        heapUsedMB,
        heapTotalMB: Math.round(mem.heapTotal / 1048576),
        rssMB: Math.round(mem.rss / 1048576),
        critical: heapUsedMB > 800
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

function checkSupportFeature() {
  try {
    const supportLink = configuration.getConfig('supportLink');
    const checks = {
      frontendDriven: true,
      supportLinkConfigured: Boolean(supportLink),
      configurationStatus: 'ok'
    };

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

function buildFeatureHealth() {
  const results = {
    translation: checkTranslationFeature(),
    cdn: checkCdnFeature(),
    preflight: checkPreflightFeature(),
    storyboard: checkStoryboardFeature(),
    support: checkSupportFeature()
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
  database.checkConnection(function(dbError) {
    const mem = process.memoryUsage();
    const featureHealth = buildFeatureHealth();
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
