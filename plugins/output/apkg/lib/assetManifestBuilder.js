// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const fs = require('fs-extra');
const path = require('path');
const assetmanager = require('../../../../lib/assetmanager');
const logger = require('../../../../lib/logger');

/**
 * Builds the `assetManifest` manifest field from the assets.json file the
 * core 'adapt' plugin already writes into the build folder during publish
 * (lib/outputmanager.js OutputPlugin#writeCourseAssets), enriched with
 * size/mimeType from the asset collection.
 *
 * @param {string} buildFolder - the course's BUILD_FOLDER (already built)
 * @param {string} defaultLanguage - course._defaultLanguage, e.g. 'en'
 * @param {function(Error, Array)} next
 */
function buildAssetManifest(buildFolder, defaultLanguage, next) {
  var assetsJsonPath = path.join(buildFolder, 'course', defaultLanguage, 'assets.json');

  fs.readJson(assetsJsonPath, function(error, assetsJson) {
    if (error) {
      if (error.code === 'ENOENT') {
        return next(null, []);
      }
      return next(error);
    }

    var filenames = Object.keys(assetsJson || {});
    if (!filenames.length) {
      return next(null, []);
    }

    assetmanager.retrieveAsset({ filename: { $in: filenames } }, function(error, assetRecs) {
      if (error) {
        logger.log('warn', 'apkg: failed to enrich assetManifest from asset collection: ' + error.message);
        assetRecs = [];
      }

      var manifest = filenames.map(function(filename) {
        var meta = assetsJson[filename] || {};
        var doc = (assetRecs || []).find(function(a) { return a.filename === filename; });
        return {
          filename: filename,
          title: meta.title,
          description: meta.description,
          tags: meta.tags,
          size: doc ? doc.size : undefined,
          mimeType: doc ? doc.mimeType : undefined
        };
      });

      next(null, manifest);
    });
  });
}

module.exports = buildAssetManifest;
