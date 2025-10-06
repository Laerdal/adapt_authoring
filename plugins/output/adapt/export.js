// external
const archiver = require('archiver');
const async = require('async');
const fs = require('fs-extra');
const path = require('path');
// internal
const assetmanager = require('../../../lib/assetmanager');
const configuration = require('../../../lib/configuration');
const contentmanager = require('../../../lib/contentmanager');
const Constants = require('../../../lib/outputmanager').Constants;
const database = require('../../../lib/database');
const filestorage = require('../../../lib/filestorage');
const logger = require('../../../lib/logger');
const usermanager = require('../../../lib/usermanager');

const FRAMEWORK_ROOT_DIR = path.join(configuration.tempDir, configuration.getConfig('masterTenantID'), Constants.Folders.Framework);
let COURSE_DIR;
let EXPORT_DIR;
let TENANT_ID;
let COURSE_ID;
let OPTIONS = {
  forceRebuild: true
};
let metadata = {};

/**
 * Helper function to check if a value is a valid MongoDB ObjectId
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // Check if it's a 24-character hex string (MongoDB ObjectId format)
  return /^[a-f\d]{24}$/i.test(id);
}

function copyCourseThumbnail(results, done) {
  const database = require('../../../lib/database');
  
  database.getDatabase(function(error, db) {
    if (error) return done(error);
    
    db.retrieve('course', { _id: COURSE_ID }, function(error, courses) {
      if (error || !courses || !courses.length) {
        logger.log('warn', 'Failed to retrieve course for thumbnail export');
        return done();
      }
      
      const course = courses[0];
      if (!course.heroImage) {
        return done();
      }

      // Validate ObjectId before attempting to retrieve asset
      if (!isValidObjectId(course.heroImage)) {
        logger.log('warn', `Invalid ObjectId for hero image: ${course.heroImage}`);
        return done();
      }

      // Retrieve the asset details for the hero image
      db.retrieve('asset', { _id: course.heroImage }, function(error, assets) {
        if (error || !assets || !assets.length) {
          logger.log('warn', `Failed to retrieve hero image asset: ${course.heroImage}`);
          return done();
        }

        const asset = assets[0];
        
        // Get the correct storage repository
        filestorage.getStorage(asset.repository, function(error, storage) {
          if (error) {
            logger.log('warn', `Failed to retrieve storage repository: ${error.message}`);
            return done();
          }

          // Get the course language from the built course
          const courseSrcDir = path.join(EXPORT_DIR, Constants.Folders.Source, Constants.Folders.Course);
          
          // Find the language directory (usually 'en' or other language code)
          fs.readdir(courseSrcDir, function(readDirError, files) {
            if (readDirError) {
              logger.log('warn', `Failed to read course directory: ${readDirError.message}`);
              return done();
            }
            
            // Find the first directory (language folder)
            let languageDir = null;
            for (const file of files) {
              const filePath = path.join(courseSrcDir, file);
              if (fs.statSync(filePath).isDirectory()) {
                languageDir = file;
                break;
              }
            }
            
            if (!languageDir) {
              logger.log('warn', 'No language directory found in course');
              return done();
            }
            
            // Create destination directory under the course language directory
            const thumbnailDir = path.join(courseSrcDir, languageDir, 'assets', 'thumb');
            fs.ensureDir(thumbnailDir, function(error) {
              if (error) return done(error);

              // Get the source thumbnail path from storage
              const srcPath = storage.resolvePath(asset.thumbnailPath || asset.path);
              const destPath = path.join(thumbnailDir, path.basename(asset.thumbnailPath || asset.path));

              // Copy the thumbnail
              fs.copy(srcPath, destPath, function(error) {
                if (error) {
                  logger.log('warn', `Failed to copy course thumbnail: ${error.message}`);
                  return done(error);
                }
                // Store metadata about the hero image (metadata is now guaranteed to exist)
                metadata.heroImage = {
                  assetId: asset._id,
                  fileName: path.basename(asset.thumbnailPath || asset.path)
                };
                logger.log('info', `Successfully copied course thumbnail to: ${destPath}`);
                done();
              });
            });
          });
        });
      });
    });
  });
}

function exportCourse(pCourseId, request, response, next, options = {}) {
  self = this;
  const currentUser = usermanager.getCurrentUser();

  // Reset metadata for new export
  metadata = {
    assets: {},
    pluginIncludes: [],
    heroImage: null
  };

  TENANT_ID = currentUser.tenant._id;
  COURSE_ID = pCourseId;
  COURSE_DIR = path.join(FRAMEWORK_ROOT_DIR, Constants.Folders.AllCourses, TENANT_ID, COURSE_ID);
  EXPORT_DIR = path.join(configuration.tempDir, configuration.getConfig('masterTenantID'), Constants.Folders.Exports, currentUser._id);
  Object.assign(OPTIONS, options);

  async.auto({
    ensureExportDir: ensureExportDir,
    generateLatestBuild: ['ensureExportDir', generateLatestBuild],
    copyFrameworkFiles: ['generateLatestBuild', copyFrameworkFiles],
    writeThemeVariables: ['copyFrameworkFiles', writeThemeVariables],
    writeCustomStyle: ['writeThemeVariables', writeCustomStyle],
    copyCourseFiles: ['generateLatestBuild', copyCourseFiles],
    copyThumbnail: ['copyCourseFiles', copyCourseThumbnail]
    //copyAssets:['copyCourseFiles', copyAssets]
  }, async.apply(zipExport, next));
}

// creates the EXPORT_DIR if it isn't there
function ensureExportDir(exportDirEnsured) {
  fs.ensureDir(EXPORT_DIR, exportDirEnsured);
}

function generateLatestBuild(results, courseBuilt) {
  if(!OPTIONS.forceRebuild) return courseBuilt();
  self.publish(COURSE_ID, Constants.Modes.Export, null, null, courseBuilt);
}

/**
* Copy functions
*/

// copies relevant files in adapt_framework
function copyFrameworkFiles(results, filesCopied) {
  self.generateIncludesForCourse(COURSE_ID, function(error, includes) {
    if(error) {
      return filesCopied(error);
    }
    const includesRE = new RegExp(includes.map(i => `\/${i}(\/|$)`).join('|'));
    const excludesRE = new RegExp(/\.git\b|\.DS_Store|\/node_modules|\/courses\b|\/course\b(?!\.)|\/exports\b/);
    const pluginsRE = new RegExp('\/components\/|\/extensions\/|\/menu\/|\/theme\/');

    fs.copy(FRAMEWORK_ROOT_DIR, EXPORT_DIR, {
      filter: function(filePath) {
        const posixFilePath = filePath.replace(/\\/g, '/');
        const isIncluded = posixFilePath.search(includesRE) > -1;
        const isExcluded = posixFilePath.search(excludesRE) > -1;
        const isPlugin = posixFilePath.search(pluginsRE) > -1;
        // exclude any matches to excludesRE
        if(isExcluded) return false;
        // exclude any plugins not in includes
        else if(isPlugin) return isIncluded;
        // include everything else
        else return true;
      }
    }, filesCopied);
  });
}

function writeThemeVariables(results, variablesWritten) {
  self.getCourseJSON(TENANT_ID, COURSE_ID, function(error, data) {
    if (error) {
      return variablesWritten(error);
    }
    const themeVariables = data.course[0].themeVariables;
    const themeName = data.config[0]._theme;
    const destinationFolder = path.join(EXPORT_DIR, 'src', 'theme', themeName);

    if (!themeVariables) {
      return variablesWritten(null);
    }


    database.getDatabase(function (err, db) {
      if (err) {
        return variablesWritten(err);
      }

      db.retrieve('themetype', {name: themeName}, {}, function(err, results) {
        if (err || (results && results.length != 1)) {
          return variablesWritten(err);
        }

        var theme = results[0];

        self.writeThemeVariables(COURSE_ID, theme, themeVariables, destinationFolder, variablesWritten);
      });
    }, configuration.getConfig('dbName'));
  });
}

function writeCustomStyle(results, styleWritten) {
  const cm = new contentmanager.ContentManager();
  cm.getContentPlugin('config', function(error, plugin) {
    if(error) {
      return styleWritten(error);
    }
    plugin.retrieve({ _courseId: COURSE_ID }, {}, function(error, docs) {
      if(error) {
        return styleWritten(error);
      }
      if(docs.length !== 1) {
        return styleWritten(new Error(`Failed to find course '${COURSE_ID}'`));
      }
      const customLessDir = path.join(EXPORT_DIR, 'src', 'theme', docs[0]._theme);
      self.writeCustomStyle(TENANT_ID, COURSE_ID, customLessDir, styleWritten);
    });
  });
}

// uses the metadata list to include only relevant plugin files
function copyCustomPlugins(results, filesCopied) {
  const src = path.join(FRAMEWORK_ROOT_DIR, Constants.Folders.Source);
  const dest = path.join(EXPORT_DIR, Constants.Folders.Plugins);
  _.each(metadata.pluginIncludes, function iterator(plugin) {
    const pluginDir = path.join(src, plugin.folder, plugin.name);
    fs.copy(pluginDir, path.join(dest, plugin.name), function(err) {
      if (err) logger.log('error', err);
    });
  });
  filesCopied();
}

// copies everything in the course folder
function copyCourseFiles(results, filesCopied) {
  const source = path.join(COURSE_DIR, Constants.Folders.Build, Constants.Folders.Course);
  const dest = path.join(EXPORT_DIR, Constants.Folders.Source, Constants.Folders.Course);
  fs.ensureDir(dest, function(error) {
    if (error) {
      return filesCopied(error);
    }
    fs.copy(source, dest, filesCopied);
  });
}

// copies used assets directly from the data folder
function copyAssets(results, assetsCopied) {
  const dest = path.join(EXPORT_DIR, Constants.Folders.Assets);
  fs.ensureDir(dest, function(error) {
    if (error) {
      return assetsCopied(error);
    }
    async.each(Object.keys(metadata.assets), function iterator(assetKey, doneIterator) {
      const oldId = metadata.assets[assetKey].oldId;
      assetmanager.retrieveAsset({ _id:oldId }, function(error, results) {
        if(error) {
          return doneIterator(error);
        }
        filestorage.getStorage(results[0].repository, function gotStorage(error, storage) {
          const srcPath = storage.resolvePath(results[0].path);
          const destPath = path.join(dest, assetKey);
          fs.copy(srcPath, destPath, doneIterator);
        });
      });
    }, assetsCopied);
  });
}

/**
* post-processing
*/

function zipExport(next, error, results) {
  if(error) {
    return next(error);
  }
  const archive = archiver('zip');
  const output = fs.createWriteStream(EXPORT_DIR +  '.zip');

  output.on('close', async.apply(cleanUpExport, next));
  archive.on('error', async.apply(cleanUpExport, next));
  archive.on('warning', error => logger.log('warn', error));
  archive.pipe(output);
  archive.glob('**/*', { cwd: path.join(EXPORT_DIR), pattern: '*', dot: true });
  archive.finalize();
}

// remove the EXPORT_DIR, if there is one
function cleanUpExport(next, exportError) {
  fs.remove(EXPORT_DIR, function(removeError) {
    const error = exportError || removeError;
    if(error) logger.log('error', error);
    next(error);
  });
}

module.exports = exportCourse;
