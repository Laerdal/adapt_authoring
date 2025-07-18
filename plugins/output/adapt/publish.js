// external
const archiver = require('archiver');
const async = require('async');
const exec = require('child_process').exec;
const fs = require('fs-extra');
const path = require('path');
const semver = require('semver');
// internal
const configuration = require('../../../lib/configuration');
const Constants = require('../../../lib/outputmanager').Constants;
const helpers = require('../../../lib/helpers');
const installHelpers = require('../../../lib/installHelpers');
const logger = require('../../../lib/logger');
const origin = require('../../../');
const outputHelpers = require('./outputHelpers');
const usermanager = require('../../../lib/usermanager');

function publishCourse(courseId, mode, request, response, next) {
  let app = origin();
  let self = this;
  let user = usermanager.getCurrentUser();
  let tenantId = user.tenant._id;
  let outputJson = {};
  let isRebuildRequired = false;
  let themeName;
  let menuName;
  let frameworkVersion;
  let isForceRebuild;

  let resultObject = {};

  // shorthand directories
  const FRAMEWORK_ROOT_FOLDER = path.join(configuration.tempDir, configuration.getConfig('masterTenantID'), Constants.Folders.Framework);
  const SRC_FOLDER = path.join(FRAMEWORK_ROOT_FOLDER, Constants.Folders.Source);
  const COURSES_FOLDER = path.join(FRAMEWORK_ROOT_FOLDER, Constants.Folders.AllCourses);
  const COURSE_FOLDER = path.join(COURSES_FOLDER, tenantId, courseId);
  const BUILD_FOLDER = path.join(COURSE_FOLDER, Constants.Folders.Build);

  let customPluginName = user._id;

  const getGruntFatalError = stdout => {
    const indexStart = stdout.indexOf('\nFatal error: ');

    if (indexStart === -1) return;

    const indexEnd = stdout.indexOf('\n\nExecution Time');

    return stdout.substring(indexStart, indexEnd !== -1 ? indexEnd : stdout.length);
  }

  async.waterfall([
    // get an object with all the course data
    function(callback) {
      self.getCourseJSON(tenantId, courseId, function(err, data) {
        if (err) {
          return callback(err);
        }
        // Store off the retrieved collections
        outputJson = data;
        callback(null);
      });
    },
    // validate the course data
    function(callback) {
      outputHelpers.validateCourse(outputJson, function(error, isValid) {
        if (error || !isValid) {
          return callback({ message: error });
        }

        callback(null);
      });
    },
    //
    function(callback) {
      var temporaryThemeFolder = path.join(SRC_FOLDER, Constants.Folders.Theme, customPluginName);
      self.applyTheme(tenantId, courseId, outputJson, temporaryThemeFolder, function(err, appliedThemeName) {
        if (err) {
          return callback(err);
        }

        self.writeCustomStyle(tenantId, courseId, temporaryThemeFolder, function(err) {
          if (err) {
            return callback(err);
          }
          // Replace the theme in outputJson with the applied theme name.
          themeName = appliedThemeName;
          outputJson['config'][0]._theme = themeName;
          callback(null);
        });
      });
    },
    function(callback) {
      self.sanitizeCourseJSON(mode, outputJson, function(err, data) {
        if (err) {
          return callback(err);
        }
        // Update the JSON object
        outputJson = data;
        callback(null);
      });
    },
    function(callback) {
      self.buildFlagExists(path.join(BUILD_FOLDER, Constants.Filenames.Rebuild), function(err, buildFlagExists) {
        if (err) {
          return callback(err);
        }
        isForceRebuild = request && request.query.force === 'true';

        if (!fs.existsSync(path.normalize(BUILD_FOLDER + '/index.html'))) {
          buildFlagExists = true;
        }

        if (mode === Constants.Modes.Export || mode === Constants.Modes.Publish || buildFlagExists || isForceRebuild) {
          isRebuildRequired = true;
        }
        callback(null);
      });
    },
    function(callback) {
      if (mode === Constants.Modes.Export || mode === Constants.Modes.Publish || isForceRebuild) {
        fs.emptyDirSync(BUILD_FOLDER);
      }
      callback(null);
    },
    function(callback) {
      var temporaryMenuFolder = path.join(SRC_FOLDER, Constants.Folders.Menu, customPluginName);
      self.applyMenu(tenantId, courseId, outputJson, temporaryMenuFolder, function(err, appliedMenuName) {
        if (err) {
          return callback(err);
        }
        menuName = appliedMenuName;
        callback(null);
      });
    },
    function(callback) {
      var assetsJsonFolder = path.join(BUILD_FOLDER, Constants.Folders.Course, outputJson['config']._defaultLanguage);
      var assetsFolder = path.join(assetsJsonFolder, Constants.Folders.Assets);

      self.writeCourseAssets(tenantId, courseId, assetsJsonFolder, assetsFolder, outputJson, mode, function(err, modifiedJson) {
        if (err) {
          return callback(err);
        }
        // Store the JSON with the new paths to assets
        // Remove _enabledExtensions["preview-edit"] and _previewEdit from the published course, if they are present.
        if (mode === Constants.Modes.Publish) {
          
          // Function to recursively remove preview-edit references
          function removePreviewEditReferences(obj) {
            if (typeof obj !== 'object' || obj === null) return;

            // Remove preview-edit from enabled extensions
            if (obj._enabledExtensions && obj._enabledExtensions['preview-edit']) {
              delete obj._enabledExtensions['preview-edit'];
            }

            // Remove preview-edit configuration
            if (obj._previewEdit) {
              delete obj._previewEdit;
            }

            // Recursively check nested objects and arrays
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                if (Array.isArray(obj[key])) {
                  obj[key].forEach(item => removePreviewEditReferences(item));
                } else if (typeof obj[key] === 'object') {
                  removePreviewEditReferences(obj[key]);
                }
              }
            }
          }

          // Apply the cleanup to the entire modifiedJson object
          removePreviewEditReferences(modifiedJson);
        }
        outputJson = modifiedJson;
        callback(null);
      });
    },
    function (callback) {
      // Check if the Authoring Tool environment allows for plugins to run scripts
      // e.g. "*" for all plugins, or "adapt-plugin1, adapt-plugin2" for specific plugins
      const scriptSafe = configuration.getConfig('scriptSafe');
      
      if(!scriptSafe){
        return callback(null);
      }
      
      logger.log(
        'info',
        'Adding scriptSafe plugins from config: ' + scriptSafe
      );
      
      outputJson.config.build = outputJson.config?.build || {};
      outputJson.config.build.scriptSafe = scriptSafe;

      callback(null);
    },
    function(callback) {
      self.writeCourseJSON(outputJson, path.join(BUILD_FOLDER, Constants.Folders.Course), function(err) {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      installHelpers.getInstalledFrameworkVersion(function(error, version) {
        frameworkVersion = version;
        callback(error);
      });
    },
    function(callback) {
      if (!isRebuildRequired) {
        return callback();
      }
      logger.log('info', 'Attempting to update browserslist');
      exec('npx browserslist --update-db', { cwd: FRAMEWORK_ROOT_FOLDER }, e => callback(e));
    },
    function(callback) {
      if (!isRebuildRequired) {
        resultObject.success = true;
        return callback(null, 'Framework already built, nothing to do');
      }

      logger.log('info', '3.1. Ensuring framework build exists');

      var args = [];
      var outputFolder = COURSE_FOLDER.replace(FRAMEWORK_ROOT_FOLDER + path.sep,'');

      // Append the 'build' folder to later versions of the framework
      if (semver.gte(semver.clean(frameworkVersion), semver.clean('2.0.0'))) {
        outputFolder = path.join(outputFolder, Constants.Folders.Build);
      }

      args.push('--outputdir=' + outputFolder);
      args.push('--theme=' + themeName);
      args.push('--menu=' + menuName);

      logger.log('info', '3.2. Using theme: ' + themeName);
      logger.log('info', '3.3. Using menu: ' + menuName);

      var generateSourcemap = outputJson.config._generateSourcemap;
      var buildMode = generateSourcemap === true ? 'dev' : 'prod';

      logger.log('info', 'npx grunt server-build:' + buildMode + ' ' + args.join(' '));

      child = exec('npx grunt server-build:' + buildMode + ' ' + args.join(' '), {cwd: path.join(FRAMEWORK_ROOT_FOLDER)}, function(error, stdout, stderr) {
        if (error !== null) {
          logger.log('error', 'exec error: ' + error);
          logger.log('error', 'stdout error: ' + stdout);
          error.message += getGruntFatalError(stdout) || '';
          resultObject.success = true;
          return callback(error, 'Error building framework');
        }

        if (stdout.length != 0) {
          logger.log('info', 'stdout: ' + stdout);
          resultObject.success = true;

          // Indicate that the course has built successfully
          app.emit('previewCreated', tenantId, courseId, outputFolder);

          return callback(null, 'Framework built OK');
        }

        if (stderr.length != 0) {
          logger.log('error', 'stderr: ' + stderr);
          resultObject.success = false;
          return callback(stderr, 'Error (stderr) building framework!');
        }

        resultObject.success = true;
        return callback(null, 'Framework built');
      });
    },
    function(err, callback) {
      self.clearBuildFlag(path.join(BUILD_FOLDER, Constants.Filenames.Rebuild), function(err) {
        callback(null);
      });
    },
    function(callback) {
      const configPath = path.join(BUILD_FOLDER, Constants.Folders.Course, Constants.CourseCollections.config.filename);
      self.removeBuildIncludes(configPath, err => callback(err));
    },
    function(callback) {
      if (mode === Constants.Modes.Preview) { // No download required -- skip this step
        return callback();
      }
      // Now zip the build package
      var filename = path.join(COURSE_FOLDER, Constants.Filenames.Download);
      var zipName = helpers.slugify(outputJson['course'].title);
      var output = fs.createWriteStream(filename);
      var archive = archiver('zip');

      output.on('close', function() {
        resultObject.filename = filename;
        resultObject.zipName = zipName;
        // Indicate that the zip file is ready for download
        app.emit('zipCreated', tenantId, courseId, filename, zipName);
        callback();
      });
      archive.on('error', function(err) {
        logger.log('error', err);
        callback(err);
      });
      archive.pipe(output);
      archive.glob('**/*', { cwd: path.join(BUILD_FOLDER) });
      archive.finalize();
    }
  ], function(err) {
    if (err) {
      logger.log('error', err);
      return next(err);
    }
    next(null, resultObject);
  });
}

module.exports = publishCourse;
