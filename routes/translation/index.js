const express = require('express');
const semver = require('semver');
const configuration = require('../../lib/configuration');
const PACKAGE = require('../../plugins/services/translation/package.json');

const server = module.exports = express();

function evaluateDependencyHealth() {
  const dependencies = PACKAGE.dependencies || {};
  const dependencyNames = Object.keys(dependencies);
  const missingPackages = [];
  const versionMismatchPackages = [];

  dependencyNames.forEach(function(dependencyName) {
    const expectedRange = dependencies[dependencyName];
    let resolvedPackageJsonPath;

    try {
      resolvedPackageJsonPath = require.resolve(dependencyName + '/package.json', {
        paths: [__dirname]
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

server.get('/api/translation/health', function(req, res) {
  const plugins = configuration.getConfig('plugins') || {};
  const cfg = plugins['adapt-services-translation'] || null;
  const dependencyHealth = evaluateDependencyHealth();

  const checks = {
    configPresent: Boolean(cfg),
    dependencyPresent: dependencyHealth.dependencyPresent
  };

  let status = 'ok';
  let error = null;

  if (!checks.configPresent) {
    status = 'down';
    error = 'Translation plugin config missing';
  }

  if (!checks.dependencyPresent) {
    status = 'down';
    error = dependencyHealth.dependencyError;
  }

  res.json({
    status,
    plugin: {
      name: 'adapt-services-translation',
      enabled: cfg ? cfg.isEnabled !== false : false
    },
    checks,
    error,
    timestamp: new Date().toISOString()
  });
});