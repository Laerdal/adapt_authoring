// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const _ = require('underscore');
const async = require('async');
const configuration = require('../../../lib/configuration');
const Constants = require('../../../lib/outputmanager').Constants;
const database = require("../../../lib/database");
const filestorage = require('../../../lib/filestorage');
const fs = require("fs-extra");
const glob = require('glob');
const helpers = require('./outputHelpers');
const logger = require("../../../lib/logger");
const mime = require('mime');
const path = require("path");
const { promisify } = require('util');
const { getDB, closeDB } = require('./dbIndex');

function ImportSource(req, done) {
  var dbInstance;

  var contentMap = {
    course: 'course',
    config: 'config',
    contentobject: 'contentObjects',
    article: 'articles',
    block: 'blocks',
    component: 'components'
  };
  var cachedJson = {};
  var plugindata = {
    pluginTypes: [
      { type: 'component', folder: 'components' },
      { type: 'extension', folder: 'extensions', attribute: '_extensions' },
      { type: 'menu', folder: 'menu', attribute: 'menuSettings' },
      { type: 'theme', folder: 'theme', attribute: 'themeSettings' }
    ],
    pluginIncludes: [],
    theme: [],
    menu: []
  };
  var metadata = {
    idMap: {},
    assetNameMap: {}
  };
  var detachedElementsMap = Object.create(null);
  var pluginLocations = {};
  var enabledExtensions = {};
  var userId = app.usermanager.getCurrentUser()._id;
  var tenantId = app.usermanager.getCurrentUser().tenant._id;
  var unzipFolder = tenantId + '_' + userId + '_unzipped';
  var COURSE_ROOT_FOLDER = path.join(configuration.tempDir, configuration.getConfig('masterTenantID'), Constants.Folders.Framework, Constants.Folders.AllCourses, tenantId, unzipFolder);
  var COURSE_JSON_PATH = path.join(COURSE_ROOT_FOLDER, Constants.Folders.Source, Constants.Folders.Course);
  var IMPORT_INFO_FILE = 'importInfo.json';
  var origCourseId;
  var courseId;
  var PATH_REXEX = new RegExp(/(course\/)((\w)*\/)*(\w)*.[a-zA-Z0-9]+/gi);

  // Values retrieved from importInfo.json
  var COURSE_LANG;
  var formTags;
  var assetFolders = [];
  var details = {};
  var cleanupDirs = [];

  /**
  * Main process
  * All functions delegated below for readability
  */
  async.series([
    retrieveImportInfo,
    prepare,
    installPlugins,
    addAssets,
    cacheMetadata,
    importContent,
  ], (importErr, result) => { // cleanup should run regardless of import success
    helpers.cleanUpImport(cleanupDirs, cleanUpErr => done(importErr || cleanUpErr));
  });

  function retrieveImportInfo(cb) {
    fs.readJson(path.join(COURSE_ROOT_FOLDER, IMPORT_INFO_FILE), function (error, obj) {
      if (error) return cb(error);
      COURSE_LANG = obj.COURSE_LANG;
      formTags = obj.formTags;
      assetFolders = obj.assetFolders;
      plugindata.pluginIncludes = obj.pluginIncludes;
      details = obj.details;
      cleanupDirs = obj.cleanupDirs;
      cb();
    });
  }

  function prepare(cb) {
    async.parallel([
      function (cb2) {
        database.getDatabase(function (error, db) {
          if (error) return cb2(error);
          dbInstance = db;
          cb2();
        });
      },
      function (cb2) {
        async.eachSeries(Object.keys(contentMap), function (type, cb3) {
          var jsonPath = path.join(COURSE_JSON_PATH, (type !== 'config') ? COURSE_LANG : '', `${contentMap[type] || type}.json`);
          fs.readJson(jsonPath, function (error, jsonData) {
            if (error) {
              logger.log('error', error)
              return cb2(error);
            } // NOTE also save the json for later, no need to load it twice
            cachedJson[type] = jsonData;
            cb3();
          });
        }, cb2);
      }
    ], cb);
  }

  /**
  * Installs any custom plugins
  */
  function installPlugins(done) {
    async.each(plugindata.pluginIncludes, function (pluginData, donePluginIterator) {
      // Ignore white & amber, nothing to install
      if (pluginData.name in details.pluginVersions.white ||
        pluginData.name in details.pluginVersions.amber) {
        return donePluginIterator();
      }

      // Red shouldn't make it this far - throw error
      if (pluginData.name in details.pluginVersions.red) {
        return donePluginIterator('Incompatible plugin ' + pluginData.name);
      }

      // Green plugins need to be installed (either fresh install or update)
      helpers.importPlugin(pluginData.location, pluginData.type, donePluginIterator);
    }, done);
  }

  /**
  * Imports assets to the library. If the course to be imported contains an assets.json file
  * (it was exported from the authoring tool) then use metadata from this file to populate the
  * title, description and tag fields, these will be used to create a new asset if an asset
  * with matching filename is not found in the database.
  */
  function addAssets(done) {
    async.eachSeries(assetFolders, function iterator(assetDir, doneAssetFolder) {
      var assetDirPath = path.join(COURSE_JSON_PATH, COURSE_LANG, assetDir);

      if (!fs.existsSync(assetDirPath)) {
        logger.log('error', 'Framework import error. Cannot find folder: ' + assetDirPath);
        return doneAssetFolder();
      }
      var assetsGlob = path.join(COURSE_JSON_PATH, COURSE_LANG, assetDir, '*');
      var assetsJsonFilename = path.join(COURSE_JSON_PATH, COURSE_LANG, Constants.Filenames.Assets);
      var assetsJson = {};

      if (fs.existsSync(assetsJsonFilename)) {
        assetsJson = fs.readJSONSync(assetsJsonFilename);
      }
      glob(assetsGlob, function (error, assets) {
        if (error) {
          return doneAssetFolder(error);
        }
        var repository = configuration.getConfig('filestorage') || 'localfs';
        async.eachSeries(assets, function iterator(assetPath, doneAsset) {
          if (error) {
            return doneAsset(error);
          }
          
          // Skip directories - only process files
          var fileStat = fs.statSync(assetPath);
          if (fileStat.isDirectory()) {
            logger.log('info', 'Skipping directory: ' + assetPath);
            return doneAsset();
          }
          
          var assetName = path.basename(assetPath);
          var assetExt = path.extname(assetPath);
          var assetId = path.basename(assetPath);
          var assetTitle = assetName;
          var assetDescription = assetName;
          var assetJson = assetsJson[assetName];
          var tags = [];

          let fileType = mime.getType(assetName);
          if (!fileType) {
            //Handling H5P fileType null/undefined
            if (assetExt.toLowerCase() === '.h5p') {
              fileType = 'application/octet-stream';
            }
          }

          var fileMeta = {
            oldId: assetId,
            title: assetTitle,
            type: fileType,
            size: fileStat["size"],
            filename: assetName,
            description: assetDescription,
            path: assetPath,
            tags: tags,
            repository: repository,
            createdBy: app.usermanager.getCurrentUser()._id
          };

          if (!assetJson) return helpers.importAsset(fileMeta, metadata, function(err, assetRec) {
            doneAsset(err);
          });

          addAssetTags(assetJson, function (error, assetTags) {
            const warn = (error) => logger.log('warn', `Failed to create asset tag ${error}`);
            if (error) return warn(new Error(error));
            fileMeta.title = assetJson.title;
            fileMeta.description = assetJson.description;
            fileMeta.tags = assetTags;
            helpers.importAsset(fileMeta, metadata, function(err, assetRec) {
              doneAsset(err);
            });
          });
        }, doneAssetFolder);
      });
    }, done);
  }

  function addAssetTags(assetJson, cb) {
    var assetTags = [];
    assetJson.tags.forEach(function (tag) {
      var tagTitle = tag.title;
      if (!tagTitle) return cb('Tag has no title');
      app.contentmanager.getContentPlugin('tag', function (error, plugin) {
        if (error) return cb(tagTitle.concat(' ', error));
        plugin.create({ title: tagTitle }, function (error, record) { // @note retrieves if tag already exists
          if (error) return cb(tagTitle.concat(' ', error));
          assetTags.push(record._id);
        });
      });
    });
    cb(null, assetTags);
  }

  /**
  * Stores plugin metadata for use later
  */
  function cacheMetadata(done) {
    async.each(plugindata.pluginTypes, storePlugintype, done);
  }

  function storePlugintype(pluginTypeData, cb) {
    const type = pluginTypeData.type;
    dbInstance.retrieve(`${type}type`, {}, { jsonOnly: true }, function (error, results) {
      if (error) {
        return cb(error);
      }
      async.each(results, function (plugin, cb2) {
        const properties = plugin.properties;
        const locations = properties && properties.pluginLocations;
        if (!metadata[`${type}Map`]) {
          metadata[`${type}Map`] = {};
        }
        metadata[`${type}Map`][plugin[type]] = {
          targetAttribute: plugin.targetAttribute,
          version: plugin.version,
          name: plugin.name,
          _id: plugin._id
        };
        if (locations) {
          if (!pluginLocations[type]) {
            pluginLocations[type] = {};
          }
          pluginLocations[type][plugin.targetAttribute] = locations;
        }
        cb2();
      }, cb);
    });
  }


  /**
  * Creates the course content
  */
  function importContent(done) {
    async.series([
      function enableExtensions(cb) {
        var includeExtensions = {};
        async.eachSeries(plugindata.pluginIncludes, function (pluginData, doneItemIterator) {
          switch (pluginData.type) {
            case 'extension':
              fs.readJson(path.join(pluginData.location, Constants.Filenames.Bower), function (error, extensionJson) {
                if (error) return cb(error);
                includeExtensions[extensionJson.extension] = metadata.extensionMap[extensionJson.extension];
                doneItemIterator();
              });
              break;
            case 'theme':
              // add the theme name to config JSON
              fs.readJson(path.join(pluginData.location, Constants.Filenames.Bower), function (error, themeJson) {
                if (error) return doneItemIterator(error);
                plugindata.theme.push({ _theme: themeJson.name });
                doneItemIterator();
              });
              break;
            case 'menu':
              // add the menu name to config JSON
              fs.readJson(path.join(pluginData.location, Constants.Filenames.Bower), function (error, menuJson) {
                if (error) return doneItemIterator(error);
                plugindata.menu.push({ _menu: menuJson.name });
                doneItemIterator();
              });
              break;
            default:
              doneItemIterator();
              break;
          }
        }, function (error) {
          if (error) return cb(error);

          enabledExtensions = {
            "_enabledExtensions": includeExtensions
          };
          cb();
        });
      },
      function createContent(cb) {
        async.eachSeries(Object.keys(contentMap), function (type, cb2) {
          var contentJson = cachedJson[type];
          switch (type) {
            case 'course': {
              createContentItem(type, contentJson, function (error, courseRec) {
                if (error) return cb2(error);
                origCourseId = contentJson._id;
                courseId = metadata.idMap[origCourseId] = courseRec._id;
                cb2();
              });
              return;
            }
            case 'config': {
              createContentItem(type, contentJson, cb2);
              return;
            }
            case 'contentobject': { // Sorts in-place the content objects to make sure processing can happen
              var byParent = _.groupBy(contentJson, '_parentId');
              Object.keys(byParent).forEach(id => {
                byParent[id].forEach((item, index) => item._sortOrder = index + 1);
              });
              var groups = _.groupBy(contentJson, '_type');
              var sortedSections = helpers.sortContentObjects(groups.menu, origCourseId, []);
              contentJson = sortedSections.concat(groups.page);
            }
          }
          // assume we're using arrays
          async.eachSeries(contentJson, function (item, cb3) {
            createContentItem(type, item, function (error, contentRec) {
              if (error) {
                return cb3(error);
              }
              if (!contentRec || !contentRec._id) {
                logger.log('warn', 'Failed to create map for ' + item._id);
                return cb3();
              }
              metadata.idMap[item._id] = contentRec._id;
              cb3();
            });
          }, cb2);
        }, cb);
      },
      async function populateGlobals() {
        const dbRetrieve = promisify(dbInstance.retrieve.bind(dbInstance));
        const dbUpdate = promisify(dbInstance.update.bind(dbInstance));
        const courseQuery = await dbRetrieve('course', { _id: courseId });
        const courseGlobals = courseQuery[0]._doc._globals || {};
        await Promise.all(plugindata.pluginIncludes.map(async ({ type, name }) => {
          const pluginQuery = await dbRetrieve(`${type}type`, { name });
          const plugin = pluginQuery[0]._doc;
          const schemaGlobals = plugin.globals;
          if (!schemaGlobals) return;
          const schemaDefaults = {};
          const typeKey = type === 'component' || type === 'extension' ? `_${type}s` : `_${type}`;
          const pluginKey = `_${plugin[type]}`;
          if (!courseGlobals[typeKey]) {
            courseGlobals[typeKey] = {};
          }
          Object.entries(schemaGlobals).forEach(([key, value]) => {
            schemaDefaults[key] = value.default;
          });
          courseGlobals[typeKey][pluginKey] = _.defaults(courseGlobals[typeKey][pluginKey], schemaDefaults);
        }));
        await dbUpdate('course', { _id: courseId }, { _globals: courseGlobals });
      },

      // Function to retrieve the course and update the start IDs
      async function referenceId() {
        let db;
        try {
          db = await getDB(); // Retrieve the database connection

          // Retrieve the course by its ID
          const course = await db.collection('courses').findOne({ _id: courseId });
          if (!course) throw new Error('Course not found');

          // Retrieve components associated with the course
          const components = await db.collection('components').find({ _courseId: courseId }).toArray();
          if (!components || components.length === 0) throw new Error('Components not found');

          // Retrieve blocks associated with the course
          const blocks = await db.collection('blocks').find({ _courseId: courseId }).toArray();
          if (!blocks || blocks.length === 0) throw new Error('Blocks not found');

          const articles = await db.collection('articles').find({ _courseId: courseId }).toArray();
          if (!articles || articles.length === 0) throw new Error('Articles not found');

          // update the configObject with the new footer custom id
          const configObject = await db.collection('contentobjects').find({ _courseId: courseId }).toArray();
          if (!configObject) throw new Error('ConfigObject not found');

          // Update course start IDs
          await updateCourseStartId(db, course);

          // Update components with new view IDs
          await updateComponentCollection(db, components);

          // Update blocks with new branching properties with contrib
          await updateBlocksCollectionContrib(db, blocks);

          // update article with new branching properties with contrib
          await updateArticleCollectionContrib(db, articles);

          // Update blocks with new branching properties
          await updateBlocksCollection(db, blocks);

          // update article with new branching properties
          await updateArticleCollection(db, articles);

          // Update the configObject with the new footer custom id
          await updateContentObject(db, configObject);

        } catch (error) {
          console.error('Error during reference ID processing:', error);
        } finally {
          // Ensure the database connection is closed
          if (db?.client?.topology && !db.client.topology.isDestroyed()) {
            await closeDB();
          }
        }
      },

      // Function to set course thumbnail from imported thumbnail files
      function setCourseHeroImage(cb) {
        try {
          const thumbnailDir = path.join(COURSE_ROOT_FOLDER, Constants.Folders.Source, Constants.Folders.Course, COURSE_LANG, 'assets', 'thumb');
          
          if (!fs.existsSync(thumbnailDir)) {
            logger.log('info', 'No thumbnail directory found during import');
            return cb();
          }

          const thumbnailFiles = fs.readdirSync(thumbnailDir);
          
          if (thumbnailFiles.length === 0) {
            logger.log('info', 'No thumbnail files found during import');
            return cb();
          }

          // Find the first thumbnail file (typically there should be only one)
          const thumbnailFile = thumbnailFiles[0];
          logger.log('info', `Processing course thumbnail: ${thumbnailFile}`);
          
          // Extract original filename without _thumb suffix
          let originalFileName = thumbnailFile;
          const thumbSuffix = '_thumb';
          
          // Handle cases like: "filename.ext_thumb.ext" -> "filename.ext"
          if (originalFileName.includes(thumbSuffix)) {
            const thumbIndex = originalFileName.indexOf(thumbSuffix);
            if (thumbIndex > -1) {
              // Get the part before _thumb
              const beforeThumb = originalFileName.substring(0, thumbIndex);
              // Check if there's a file extension before _thumb
              if (beforeThumb.includes('.')) {
                originalFileName = beforeThumb;
              } else {
                // Fallback: remove _thumb and everything after it
                originalFileName = beforeThumb;
              }
            }
          }
          
          logger.log('info', `Looking for asset with original filename: ${originalFileName}`);
          
          // Search for the original asset by filename
          app.assetmanager.retrieveAsset({ filename: originalFileName }, function(error, assets) {
            if (error) {
              logger.log('warn', `Error retrieving asset by filename: ${error.message}`);
              return cb();
            }
            
            if (assets && assets.length > 0) {
              const matchingAsset = assets[0];
              logger.log('info', `Found matching asset: ${matchingAsset._id} -> ${matchingAsset.filename}`);
              
              // Update the course with heroImage
              updateCourseHeroImage(matchingAsset._id, cb);
            } else {
              logger.log('info', `No direct match found for: ${originalFileName}, searching in metadata...`);
              
              // Fallback 1: search in metadata.assetNameMap for any asset that could match
              let matchingAssetId = null;
              for (const [assetId, assetName] of Object.entries(metadata.assetNameMap)) {
                if (assetName === originalFileName) {
                  matchingAssetId = assetId;
                  logger.log('info', `Found matching asset in metadata: ${assetId} -> ${assetName}`);
                  break;
                }
              }
              
              if (matchingAssetId) {
                updateCourseHeroImage(matchingAssetId, cb);
              } else {
                // Fallback 2: Search all assets by title or description that might match
                logger.log('info', 'Searching all assets for potential matches...');
                app.assetmanager.retrieveAsset({}, function(allAssetsError, allAssets) {
                  if (allAssetsError || !allAssets || allAssets.length === 0) {
                    logger.log('info', `No assets found in database. Creating new asset from thumbnail.`);
                    return createAssetFromThumbnail(thumbnailDir, thumbnailFile, originalFileName, cb);
                  }
                  
                  // Look for assets whose title, filename, or path might match
                  const potentialMatches = allAssets.filter(asset => {
                    return asset.title === originalFileName || 
                           asset.filename === originalFileName ||
                           asset.path.includes(originalFileName) ||
                           (asset.title && asset.title.includes(originalFileName.split('.')[0]));
                  });
                  
                  if (potentialMatches.length > 0) {
                    const bestMatch = potentialMatches[0];
                    logger.log('info', `Found potential matching asset: ${bestMatch._id} -> ${bestMatch.filename} (title: ${bestMatch.title})`);
                    updateCourseHeroImage(bestMatch._id, cb);
                  } else {
                    logger.log('info', `No matching asset found for thumbnail: ${thumbnailFile}. Creating new asset from thumbnail.`);
                    createAssetFromThumbnail(thumbnailDir, thumbnailFile, originalFileName, cb);
                  }
                });
              }
            }
          });
          
        } catch (thumbnailError) {
          logger.log('warn', `Error processing course thumbnail: ${thumbnailError.message}`);
          cb();
        }
        
        function updateCourseHeroImage(assetId, callback) {
          if (!courseId) {
            logger.log('warn', 'No courseId available to set heroImage');
            return callback();
          }
          
          // Convert ObjectId to string if needed
          const assetIdStr = assetId && assetId.toString ? assetId.toString() : assetId;
          
          // Validate that assetId is a proper ObjectId
          if (!assetIdStr || typeof assetIdStr !== 'string' || !/^[a-f\d]{24}$/i.test(assetIdStr)) {
            logger.log('warn', 'Invalid assetId provided to updateCourseHeroImage: ' + assetIdStr + ' (type: ' + typeof assetId + ')');
            return callback();
          }
          
          app.contentmanager.getContentPlugin('course', function(error, plugin) {
            if (error) {
              logger.log('warn', `Error getting course plugin: ${error.message}`);
              return callback();
            }
            
            plugin.update({ _id: courseId }, { heroImage: assetIdStr }, function(updateError) {
              if (updateError) {
                logger.log('warn', `Error updating course heroImage: ${updateError.message}`);
              } else {
                logger.log('info', `Successfully set course hero image to asset: ${assetIdStr}`);
              }
              callback();
            });
          });
        }
        
        function createAssetFromThumbnail(thumbnailDir, thumbnailFile, originalFileName, callback) {
          try {
            const thumbnailPath = path.join(thumbnailDir, thumbnailFile);
            
            if (!fs.existsSync(thumbnailPath)) {
              logger.log('warn', `Thumbnail file not found: ${thumbnailPath}`);
              return callback();
            }
            
            // Test if file is readable
            try {
              fs.accessSync(thumbnailPath, fs.constants.R_OK);
              logger.log('info', `Thumbnail file is readable: ${thumbnailPath}`);
            } catch (accessError) {
              logger.log('warn', `Thumbnail file not readable: ${thumbnailPath}, error: ${accessError.message}`);
              return callback();
            }
            
            // Get file stats
            const fileStat = fs.statSync(thumbnailPath);
            const fileType = mime.getType(thumbnailFile) || 'image/gif'; // Default to gif for thumbnails
            
            logger.log('info', `Creating new asset from thumbnail: ${thumbnailFile}`);
            logger.log('info', `Thumbnail path: ${thumbnailPath}`);
            logger.log('info', `File type: ${fileType}, Size: ${fileStat.size}`);
            
            // Create asset metadata without tags to avoid validation issues
            const fileMeta = {
              oldId: thumbnailFile,
              title: `Thumbnail - ${originalFileName}`,
              type: fileType,
              size: fileStat.size,
              filename: thumbnailFile,
              description: `Auto-imported thumbnail for ${originalFileName}`,
              path: thumbnailPath,
              tags: [], // Empty tags array to avoid validation issues
              repository: configuration.getConfig('filestorage') || 'localfs',
              createdBy: app.usermanager.getCurrentUser()._id
            };
            
            logger.log('info', `Asset metadata created for ${thumbnailFile}:`);
            logger.log('info', `- Title: ${fileMeta.title}`);
            logger.log('info', `- Type: ${fileMeta.type}`);
            logger.log('info', `- Size: ${fileMeta.size}`);
            logger.log('info', `- Repository: ${fileMeta.repository}`);
            
            // Use the existing helpers.importAsset function to create the asset
            helpers.importAsset(fileMeta, metadata, function(importError, assetRecord) {
              if (importError) {
                logger.log('warn', `Error creating asset from thumbnail: ${importError.message || importError}`);
                logger.log('warn', `Full error:`, importError);
                return callback();
              }
              
              if (assetRecord && assetRecord._id) {
                logger.log('info', `Successfully created asset from thumbnail: ${assetRecord._id} -> ${assetRecord.filename}`);
                // Add to metadata mapping for future reference
                metadata.assetNameMap[assetRecord._id] = assetRecord.filename;
                updateCourseHeroImage(assetRecord._id, callback);
              } else {
                logger.log('warn', `Failed to create asset from thumbnail: ${thumbnailFile} - No asset record returned`);
                callback();
              }
            });
            
          } catch (error) {
            logger.log('warn', `Error processing thumbnail file ${thumbnailFile}: ${error.message}`);
            logger.log('warn', `Full error:`, error);
            callback();
          }
        }
      },

      function checkDetachedContent(cb) {
        const detachedIds = Object.keys(detachedElementsMap);
        if (detachedIds.length === 0) return cb();

        const groups = detachedIds.reduce(function (result, id) {
          if (result[detachedElementsMap[id]] === undefined) {
            result[detachedElementsMap[id]] = [];
          }
          result[detachedElementsMap[id]].push(id);
          return result;
        }, Object.create(null));
        const errorMsg = Object.keys(groups).reduce(function (errorString, group) {
          errorString.push(`${group}'s: ${groups[group].join(',')}`);
          return errorString;
        }, [app.polyglot.t('app.importcoursepartialintro')]);
        errorMsg.push(app.polyglot.t('app.importcoursecheckcourse'));
        cb(new helpers.PartialImportError(errorMsg.join('\n')));
      },


    ], done);
  }

  // Function to update the course's start IDs in the database
  async function updateCourseStartId(db, course) {
    const updatedCourse = updateStartIds(course);

    try {
      // Update the course's _start._startIds in the database
      await db.collection('courses').updateOne(
        { _id: course._id },
        { $set: { '_start._startIds': updatedCourse._start._startIds } }
      );
      console.log('Course _start._startIds updated successfully');
    } catch (err) {
      throw new Error('Error updating the course start IDs: ' + err.message);
    }
  }

  // Function to update the component records with new properties
  async function updateComponentCollection(db, components) {
    // Update _viewId in the _additionalMaterial._items array
    await Promise.all(
      components.map(async (record) => {
        const itemsArray = record?._extensions?._additionalMaterial?._items;
        if (!itemsArray?.length) return; // Skip if no items to update

        itemsArray.forEach((item) => {
          if (item._viewType === 'modal' && item._viewTypeModal?._viewId) {
            const viewId = metadata.idMap[item._viewTypeModal._viewId];
            item._viewTypeModal._viewId = viewId || item._viewTypeModal._viewId;
          }
        });

        await db.collection('components').updateOne(
          { _id: record._id },
          { $set: { '_extensions._additionalMaterial._items': itemsArray } }
        );
      })
    );

    // Update _routeToPageReview in properties._bands._review
    await Promise.all(
      components.map(async (record) => {
        if (record._component === 'assessmentResultsTotal') {
          const properties = record.properties;
          const bands = properties?._bands;

          if (!bands?.length) return; // Skip if no bands to update

          bands.forEach((item) => {
            // Update _routeToPage for _retry
            if (item?._retry && item?._retry?._routeToPage) {
              const routeToPageRetry = metadata.idMap[item._retry._routeToPage];
              item._retry._routeToPage = routeToPageRetry || item._retry._routeToPage;
            }
            // Update _routeToPageReview for _review
            if (item._review && item?._review?._routeToPageReview) {
              const routeToPageReview = metadata.idMap[item._review._routeToPageReview];
              item._review._routeToPageReview = routeToPageReview || item._review._routeToPageReview;
            }
          });

          await db.collection('components').updateOne(
            { _id: record._id },
            { $set: { 'properties._bands': bands } } // Corrected the reference from itemsArray to bands
          );
        }
      })
    );
  }

  // Function to update the blocks with new branching properties
  async function updateBlocksCollectionContrib(db, blocks) {
    return Promise.all(
      blocks.map(async (record) => {
        const branching = record._extensions?._laerdalBranching;
        if (branching) {
          const correct = metadata.idMap[branching._correct];
          const partlyCorrect = metadata.idMap[branching._partlyCorrect];
          const incorrect = metadata.idMap[branching._incorrect];

          await db.collection('blocks').updateOne(
            { _id: record._id },
            {
              $set: {
                '_extensions._laerdalBranching._correct': correct || branching._correct,
                '_extensions._laerdalBranching._partlyCorrect': partlyCorrect || branching._partlyCorrect,
                '_extensions._laerdalBranching._incorrect': incorrect || branching._incorrect,
              },
            }
          );
        }
      })
    );
  }

  // Function to update the article records with new branching properties
  async function updateArticleCollectionContrib(db, articles) {
    return Promise.all(
      articles.map(async (record) => {
        const branching = record._extensions?._laerdalBranching;
        if (branching) {
          const start = metadata.idMap[branching._start];

          await db.collection('articles').updateOne(
            { _id: record._id },
            {
              $set: {
                '_extensions._laerdalBranching._start': start || branching._start,
              },
            }
          );
        }
      })
    );
  }

  // Function to update the blocks with new branching properties
  async function updateBlocksCollection(db, blocks) {
    return Promise.all(
      blocks.map(async (record) => {
        const branching = record._extensions?._branching;
        if (branching) {
          const correct = metadata.idMap[branching._correct];
          const partlyCorrect = metadata.idMap[branching._partlyCorrect];
          const incorrect = metadata.idMap[branching._incorrect];

          const attemptBands = branching._attemptBands?.map((band) => ({
          _attempts: band._attempts,
          _correct: metadata.idMap[band._correct] || band._correct,
          _partlyCorrect: metadata.idMap[band._partlyCorrect] || band._partlyCorrect,
          _incorrect: metadata.idMap[band._incorrect] || band._incorrect,
        })) || [];

          await db.collection('blocks').updateOne(
            { _id: record._id },
            {
              $set: {
                '_extensions._branching._correct': correct || branching._correct,
                '_extensions._branching._partlyCorrect': partlyCorrect || branching._partlyCorrect,
                '_extensions._branching._incorrect': incorrect || branching._incorrect,
                '_extensions._branching._attemptBands': attemptBands,
              },
            }
          );
        }
      })
    );
  }

  // Function to update the article records with new branching properties
  async function updateArticleCollection(db, articles) {
    return Promise.all(
      articles.map(async (record) => {
        const branching = record._extensions?._branching;
        if (branching) {
          const start = metadata.idMap[branching._start];

          await db.collection('articles').updateOne(
            { _id: record._id },
            {
              $set: {
                '_extensions._branching._start': start || branching._start,
              },
            }
          );
        }
      })
    );
  }

  // Function to update the content object with the new footer custom id
  async function updateContentObject(db, configObject) {
    return Promise.all(
      configObject.map(async (record) => {
        const customIdPath = record?._extensions?._navigationFooter?._buttons?._custom?._id;

        if (customIdPath) {
          const newFooterId = metadata.idMap[customIdPath];
          if (newFooterId) {
            await db.collection('contentobjects').updateOne(
              { _id: record._id },
              { $set: { '_extensions._navigationFooter._buttons._custom._id': newFooterId } }
            );
          }
        }
      })
    );
  }

  // Function to update the start IDs in the course object
  function updateStartIds(course) {
    const idMap = metadata.idMap;

    if (!idMap || typeof idMap !== 'object') {
      throw new Error('Invalid idMap. Ensure idMap is properly populated.');
    }
    if (!course._start || !Array.isArray(course._start._startIds)) {
      throw new Error('Invalid course data. Ensure _start and _startIds are correctly defined.');
    }
    course._start._startIds = course._start._startIds.map(start => ({
      ...start,
      _id: idMap[start._id] || start._id, // Replace the old _id with the new one from idMap, if available
    }));

    return course;
  }

  function transformContent(type, originalData) {
    return new Promise(async (resolve, reject) => {
      var data = _.extend({}, originalData);
      /**
      * Basic prep of data
      */
      delete data._id;
      delete data._trackingId;
      delete data._latestTrackingId;
      data.createdBy = app.usermanager.getCurrentUser()._id;
      if (type !== 'course') {
        data._courseId = courseId;
      }
      if (data._component) {
        data._componentType = metadata.componentMap[data._component]._id;
      }
      if (data._parentId) {
        if (metadata.idMap[data._parentId]) {
          data._parentId = metadata.idMap[data._parentId];
        } else {
          detachedElementsMap[originalData._id] = type;
          logger.log('warn', 'Cannot update ' + originalData._id + '._parentId, ' + originalData._parentId + ' not found in idMap');
          return resolve();
        }
      }
      /**
      * Content-specific attributes
      */
      if (type === 'course') {
        data = _.extend(data, { tags: formTags });
        
        // Define potential file paths to check
        const filePaths = [
          path.join(COURSE_ROOT_FOLDER, Constants.Folders.Source, Constants.Folders.Theme, plugindata.theme[0]._theme, Constants.Folders.Less, Constants.Filenames.CustomStyle),
          path.join(COURSE_ROOT_FOLDER, Constants.Folders.Source, Constants.Folders.Theme, plugindata.theme[0]._theme, Constants.Folders.Less, '2-customStyles.less'),
          path.join(COURSE_ROOT_FOLDER, Constants.Folders.Source, Constants.Folders.Theme, plugindata.theme[0]._theme, Constants.Folders.Less, 'zzzzz', '2-customStyles.less'),
        ];
      
        // Check files sequentially
        try {
          let contents = '';
          for (const filePath of filePaths) {
            try {
              contents = await fs.readFile(filePath, 'utf8');
              if (contents && contents.trim().length > 0) {
                break; // Found non-empty content
              }
            } catch (readError) {
              if (readError.code !== 'ENOENT') {
                throw readError; // Re-throw if not a file-not-found error
              }
              continue; // Try next file if current doesn't exist
            }
          }
          
          if (contents && contents.trim().length > 0) {
            data = _.extend(data, { customStyle: contents.toString() });
          }

        } catch (e) {
          return reject(e);
        }
      }
      else if (type === 'config') {
        data = _.extend(data, enabledExtensions, plugindata.theme[0], plugindata.menu[0], { "_defaultLanguage": COURSE_LANG });
      }
      /**
      * Define the custom properties and and pluginLocations
      */
      var genericPropKeys = Object.keys(dbInstance.getModel(type).schema.paths);
      var customProps = _.pick(data, _.difference(Object.keys(data), genericPropKeys));

      if (_.isEmpty(customProps)) return resolve(data);

      plugindata.pluginTypes.forEach(function (typeData) {
        if (!pluginLocations[typeData.type]) return;

        var pluginKeys = _.intersection(Object.keys(customProps), Object.keys(pluginLocations[typeData.type]));

        if (pluginKeys.length === 0) return;

        data[typeData.attribute] = _.pick(customProps, pluginKeys);
        data = _.omit(data, pluginKeys);
        customProps = _.omit(customProps, pluginKeys);
      });
      // everything else is a customer property
      data.properties = customProps;
      data = _.omit(data, Object.keys(customProps));
      if (customProps._oldId) {
        data._oldId = customProps._oldId;
      }

      resolve(data);
    });
  }

  function createContentItem(type, originalData, done) {
    var data;
    // organise functions in series, mainly for readability
    async.series([
      function transform(cb) {
        transformContent(type, originalData).then(transformedData => {
          data = transformedData;
          cb();
        }).catch(cb);
      },
      function updateAssetData(cb) {
        var newAssetPath = Constants.Folders.Course + '/' + Constants.Folders.Assets; // always use '/' for paths in content
        var traverse = require('traverse');

        traverse(data).forEach(function (value) {
          if (!_.isString(value)) return;
          var isPath = value.match(PATH_REXEX);

          if (!isPath) return;
          var dirName = path.dirname(value);
          var newDirName;

          for (index = 0; index < assetFolders.length; ++index) {
            var folderMatch = "(course\/)((\\w){2}\/)" + '(' + assetFolders[index] + ')';
            var assetFolderRegex = new RegExp(folderMatch, "gi");

            if (!dirName.match(assetFolderRegex)) continue;
            newDirName = dirName.replace(assetFolderRegex, newAssetPath);
          }

          var fileExt = path.extname(value);
          var fileName = path.basename(value);
          if (newDirName && fileName && fileExt) {
            try {
              var fileId = metadata.idMap[fileName];
              var newFileName = metadata.assetNameMap[fileId];
              if (newFileName) {
                this.update(newDirName + '/' + newFileName); // always use '/' for paths in content
              }
            } catch (e) {
              logger.log('error', e);
              return;
            }
          }
        });
        cb();
      }

    ], function (error, results) {
      if (error) return done(error);
      if (detachedElementsMap[originalData._id]) { // do not import detached elements
        return done();
      } // now we're ready to create the content
      app.contentmanager.getContentPlugin(type, function (error, plugin) {
        if (error) return done(error);
        plugin.create(data, function (error, record) {
          if (error) {
            logger.log('warn', 'Failed to import ' + type + ' ' + (originalData._id || '') + ' ' + error);
            return done();
          } // Create a courseAssets record if needed
          createCourseAssets(type, record, error => done(error, record));
        });
      });
    });
  }

  /**
  * Adds courseasset record
  * to the contentTypeId, courseId and userId.
  * @param {type} type
  * @param {object} contentData
  * @param {callback} cb
  */
  function createCourseAssets(type, contentData, cb) {
    var assetData = {
      _courseId: contentData._courseId,
      _contentType: type,
      _contentTypeParentId: contentData._parentId
    };
    // some courseassets values change depending on what content type they're for
    switch (type) {
      case 'course':
        assetData._courseId = assetData._contentTypeId = assetData._contentTypeParentId = contentData._id;
        break;
      case 'article', 'block', 'config':
        assetData._contentTypeId = contentData._componentType;
        break;
      default:
        assetData._contentTypeId = contentData._id;
        break;
    }
    var contentDataString = JSON.stringify(contentData);
    var assetArray = contentDataString.match(PATH_REXEX);
    // search through object values for file paths
    async.each(assetArray, function (data, callback) {
      delete assetData._assetId;
      if (!_.isString(data)) {
        return callback();
      }
      var assetBaseName = path.basename(data);
      // get asset _id from lookup of the key of metadata.assetNameMap mapped to assetBaseName
      var matchingAssetId = _.findKey(metadata.assetNameMap, value => value === assetBaseName);

      if (!matchingAssetId) return callback();

      app.assetmanager.retrieveAsset({ _id: matchingAssetId }, function gotAsset(error, results) {
        if (error) {
          logger.log('error', error);
          return callback(error);
        }
        Object.assign(assetData, {
          _assetId: matchingAssetId,
          createdBy: app.usermanager.getCurrentUser(),
          _fieldName: results.length > 0 ? _.pluck(results, 'filename')[0] : assetBaseName
        });
        app.contentmanager.getContentPlugin('courseasset', function (error, plugin) {
          if (error) {
            return callback(error);
          }
          plugin.create(assetData, function (error, assetRecord) {
            if (error) logger.log('warn', `Failed to create courseasset ${type} ${assetRecord || ''} ${error}`);
            callback(error);
          });
        });
      });
    }, cb);
  }


}

/**
 * Module exports
 *
 */

exports = module.exports = ImportSource;
