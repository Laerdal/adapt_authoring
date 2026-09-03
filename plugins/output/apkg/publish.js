// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const async = require('async');
const fs = require('fs-extra');
const path = require('path');

const origin = require('../../../');
const configuration = require('../../../lib/configuration');
const Constants = require('../../../lib/outputmanager').Constants;
const logger = require('../../../lib/logger');
const usermanager = require('../../../lib/usermanager');

const APKG = require('./lib/constants');
const resolveRuntimeVersion = require('./lib/frameworkVersion');
const buildPluginDependencies = require('./lib/pluginDependencyResolver');
const buildAssetManifest = require('./lib/assetManifestBuilder');
const generateManifest = require('./lib/manifestGenerator');
const packageApkg = require('./lib/packager');

/**
 * Publishes a course as a self-contained offline package (course.apkg).
 *
 * Delegates the actual Adapt Framework build to the existing 'adapt' output
 * plugin (unchanged), then post-processes the resulting build folder into
 * course.apkg: Build Adapt Course -> Extract Runtime Independent Assets ->
 * Generate Manifest -> Package Course Data -> Compress -> Generate APKG.
 *
 * Signature matches OutputManager.prototype.publish's calling convention
 * (lib/outputmanager.js): plugin.publish(courseId, mode, request, response, next).
 *
 * @param {string} courseId
 * @param {string} mode - ignored; apkg always performs a full PUBLISH build
 * @param {object} request - may be null (programmatic invocation); request.query.version is honoured if present
 * @param {object} response - passed through to the adapt plugin's publish
 * @param {function(Error, object)} next
 */
function publishApkg(courseId, mode, request, response, next) {
  var app = origin();
  var manager = app.outputmanager;

  var user = usermanager.getCurrentUser();
  var tenantId = user.tenant._id;

  var FRAMEWORK_ROOT_FOLDER = path.join(
    configuration.tempDir,
    configuration.getConfig('masterTenantID'),
    Constants.Folders.Framework
  );
  var COURSE_FOLDER = path.join(FRAMEWORK_ROOT_FOLDER, Constants.Folders.AllCourses, tenantId, courseId);
  var BUILD_FOLDER = path.join(COURSE_FOLDER, Constants.Folders.Build);

  var adaptPlugin;
  var title;
  var defaultLanguage;

  async.waterfall([
    function resolveAdaptPlugin(cb) {
      manager.getOutputPlugin('adapt', cb);
    },
    function buildCourse(plugin, cb) {
      adaptPlugin = plugin;
      adaptPlugin.publish(courseId, Constants.Modes.Publish, request, response, function(error) {
        cb(error);
      });
    },
    function readBuiltConfig(cb) {
      var configPath = path.join(BUILD_FOLDER, Constants.Folders.Course, Constants.CourseCollections.config.filename);
      fs.readJson(configPath, cb);
    },
    function readBuiltCourse(configJson, cb) {
      defaultLanguage = configJson._defaultLanguage || 'en';
      var coursePath = path.join(BUILD_FOLDER, Constants.Folders.Course, defaultLanguage, Constants.CourseCollections.course.filename);
      fs.readJson(coursePath, function(error, courseJson) {
        if (error) {
          return cb(error);
        }
        title = courseJson.title;
        cb();
      });
    },
    function resolvePluginDependencies(cb) {
      buildPluginDependencies(adaptPlugin, courseId, cb);
    },
    function resolveAssetManifest(pluginDependencies, cb) {
      buildAssetManifest(BUILD_FOLDER, defaultLanguage, function(error, assetManifest) {
        cb(error, pluginDependencies, assetManifest);
      });
    },
    function resolveFrameworkVersion(pluginDependencies, assetManifest, cb) {
      resolveRuntimeVersion(function(error, runtimeVersion) {
        cb(error, pluginDependencies, assetManifest, runtimeVersion);
      });
    },
    function buildManifest(pluginDependencies, assetManifest, runtimeVersion, cb) {
      var version = (request && request.query && request.query.version) || defaultVersion();
      generateManifest({
        courseId: courseId,
        title: title,
        version: version,
        runtimeVersion: runtimeVersion,
        pluginDependencies: pluginDependencies,
        assetManifest: assetManifest
      }, cb);
    },
    function writePackage(manifestObj, cb) {
      var destFile = path.join(COURSE_FOLDER, APKG.Filenames.Package);
      packageApkg(BUILD_FOLDER, destFile, manifestObj, function(error, result) {
        cb(error, result, manifestObj);
      });
    }
  ], function(error, result, manifestObj) {
    if (error) {
      logger.log('error', 'apkg: publish failed for course ' + courseId + ': ' + error.message);
      return next(error);
    }
    next(null, {
      success: true,
      filename: result.filename,
      manifest: manifestObj
    });
  });
}

function defaultVersion() {
  return '0.0.0-' + Date.now();
}

module.exports = publishApkg;
