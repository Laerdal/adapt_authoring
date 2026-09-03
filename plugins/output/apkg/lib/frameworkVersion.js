// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const configuration = require('../../../../lib/configuration');
const installHelpers = require('../../../../lib/installHelpers');
const logger = require('../../../../lib/logger');

/**
 * Resolves the Adapt Framework runtime version for the manifest's
 * `runtimeVersion` field.
 *
 * Primary source: the framework's own installed package.json (authoritative
 * for what actually built this course). Fallback: the framework revision
 * pinned in conf/config.json, which is a *target* revision rather than a
 * confirmed-installed version, so its use is logged as a warning.
 *
 * @param {function(Error, string)} next
 */
function resolveRuntimeVersion(next) {
  installHelpers.getInstalledFrameworkVersion(function(error, installedVersion) {
    if (!error && installedVersion) {
      return next(null, installedVersion);
    }

    var fallback = configuration.getConfig('frameworkRevision');
    if (fallback) {
      logger.log('warn', 'apkg: could not read installed framework version (' +
        (error && error.message) + '), falling back to configured frameworkRevision: ' + fallback);
      return next(null, fallback.replace(/^tags\/v?/, ''));
    }

    next(new Error('Cannot determine framework version'));
  });
}

module.exports = resolveRuntimeVersion;
