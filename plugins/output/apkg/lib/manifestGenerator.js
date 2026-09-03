// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE

/**
 * Assembles the manifest.json object embedded in every course.apkg.
 * Pure/synchronous — all inputs must already be resolved by the caller.
 *
 * @param {object} params
 * @param {string} params.courseId
 * @param {string} params.title
 * @param {string} params.version
 * @param {string} params.runtimeVersion
 * @param {Array}  params.pluginDependencies
 * @param {Array}  params.assetManifest
 * @param {function(Error, object)} next
 */
function generateManifest(params, next) {
  var required = ['courseId', 'title', 'version', 'runtimeVersion'];
  var missing = required.filter(function(key) { return !params || params[key] === undefined || params[key] === null; });
  if (missing.length) {
    return next(new Error('apkg: cannot generate manifest, missing required field(s): ' + missing.join(', ')));
  }

  next(null, {
    courseId: params.courseId,
    title: params.title,
    version: params.version,
    runtimeVersion: params.runtimeVersion,
    pluginDependencies: params.pluginDependencies || [],
    assetManifest: params.assetManifest || [],
    buildTimestamp: new Date().toISOString()
  });
}

module.exports = generateManifest;
