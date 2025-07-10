// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
/**
 * Course Content plugin type
 */

var contentmanager = require('../../../lib/contentmanager'),
    tenantmanager = require('../../../lib/tenantmanager'),
    ContentPlugin = contentmanager.ContentPlugin,
    ContentPermissionError = contentmanager.errors.ContentPermissionError,
    configuration = require('../../../lib/configuration'),
    permissions = require('../../../lib/permissions'),
    usermanager = require('../../../lib/usermanager'),
    util = require('util'),
    path = require('path'),
    async = require('async'),
    origin = require('../../../'),
    rest = require('../../../lib/rest'),
    _ = require('underscore'),
    logger = require('../../../lib/logger'),
    database = require('../../../lib/database'),
    helpers = require('../../../lib/helpers'),
    usermanager = require('../../../lib/usermanager');
    const { getDB, closeDB } = require('./dbIndex');


function CourseContent () {
}

util.inherits(CourseContent, ContentPlugin);

var DASHBOARD_COURSE_FIELDS = [
    '_id', '_tenantId', '_type', '_isShared', 'title', 'heroImage',
    'updatedAt', 'updatedBy', 'createdAt', 'createdBy', 'tags', '_shareWithUsers'
];

var metadata = {
  idMap: {},
};
var courseId;
function doQuery(req, res, andOptions, next) {
  if(!next) {
    next = andOptions;
    andOptions = [];
  }
  const options = Object.assign({}, req.body, req.query);
  options.search = Object.assign({}, req.body.search, req.query.search);
  const search = options.search || {};
  const self = this;
  const orList = [];
  const andList = [];
  async.each(Object.keys(search), function (key, nextKey) {
    // Convert string -> regex, special case $or should be within $and
    if ('string' === typeof search[key] && key !== "$or") {
      orList.push({ [key]: new RegExp(search[key], 'i') });
    } else {
      andList.push({ [key]: search[key] });
    }
    nextKey();
  }, function () {
    const query = {};

    if (orList.length) query.$or = orList;
    if(andList.length || andOptions.length) query.$and = andList.concat(andOptions);

    options.fields = DASHBOARD_COURSE_FIELDS.join(' ');
    options.populate = Object.assign({ 'createdBy': 'email firstName lastName' }, options.populate);
    options.jsonOnly = true;

    new CourseContent().retrieve(query, options, function (err, results) {
      if (err) {
        return res.status(500).json(err);
      }
      return res.status(200).json(results);
    });
  });
}
/**
 * essential setup
 *
 * @api private
 */
function initialize () {
  var self = this;
  var app = origin();

  app.once('serverStarted', function(server) {
    // force search to use only courses created by current user
    rest.get('/my/course', (req, res, next) => doQuery(req, res, [{ createdBy: req.user._id }], next));
    // Only return courses which have been shared
    rest.get('/shared/course', (req, res, next) => {
      req.body.search = Object.assign({}, req.body.search, { $or: [{ _shareWithUsers: req.user._id }, { _isShared: true }] });
      doQuery(req, res, next);
    });
    /**
     * API Endpoint to duplicate a course
     *
     * @fires ~courseDuplicated
     */

    rest.get('/duplicatecourse/:id', function (req, res, next) {
      duplicate({ _id: req.params.id }, function (error, newCourse) {
        if (error) {
          res.statusCode = 400;
          return res.json({ success: false, message: error.message });
        }

        // Emit courseDuplicated event
        app.emit('courseDuplicated', newCourse);

        // Call referenceId to update StartId and BranchId after duplicate finishes
        referenceId(newCourse._id, function (refError) {
          if (refError) {
            res.statusCode = 500;
            return res.json({ success: false, message: 'Error updating references: ' + refError.message });
          }

          // Send success response if everything is completed
          res.statusCode = 200;
          return res.json({ success: true, newCourseId: newCourse._id });
        });
      });
    });
  });



  app.contentmanager.addContentHook('update', 'course', { when: 'pre' }, function (data, next) {
    if (data[1].hasOwnProperty('themeSettings') || data[1].hasOwnProperty('customStyle')) {
      var tenantId = usermanager.getCurrentUser().tenant._id;

      app.emit('rebuildCourse', tenantId, data[0]._id);
    }

    next(null, data);
  });

  ['component'].forEach(function (contentType) {
    app.contentmanager.addContentHook('create', contentType, { when: 'pre' }, function (contentType, data, next) {
      var user = usermanager.getCurrentUser();

      database.getDatabase(function (err, db) {
        if (err) {
          logger.log('error', err);
          return next(err)
        }

        var delta = data[0];

        db.retrieve('component', { _courseId: delta._courseId, _component: delta._component }, function (err, results) {
          if (results.length == 0) {
            // This is the first time this component has been added, so trigger a rebuild.
            if (user && user.tenant && user.tenant._id) {
              app.emit('rebuildCourse', user.tenant._id, delta._courseId);
            }
          }

          return next(null, data);
        });

      });
    }.bind(null, contentType));
  });

  ['component'].forEach(function (contentType) {
    app.contentmanager.addContentHook('destroy', contentType, { when: 'pre' }, function (contentType, data, next) {
      var user = usermanager.getCurrentUser();

      database.getDatabase(function (err, db) {
        if (err) {
          logger.log('error', err);
          return next(err)
        }

        db.retrieve('component', { _id: data[0]._id }, function (err, results) {
          if (err) {
            logger.log('error', err);
            return next(err);
          }

          if (results && results.length == 1) {
            var delta = results[0];

            db.retrieve('component', { _courseId: delta._courseId, _component: delta._component }, function (err, results) {
              if (results.length <= 1) {
                // This component is no longer used in this course, so trigger a rebuild.
                if (user && user.tenant && user.tenant._id) {
                  app.emit('rebuildCourse', user.tenant._id, delta._courseId.toString());
                }
              }

              return next(null, data);
            });
          } else {
            // In theory the next line should never run.
            return next(null, data);
          }
        });
      });
    }.bind(null, contentType));
  });

  // Content Hook for updatedAt and updatedBy:
  ['contentobject', 'article', 'block', 'component'].forEach(function (contentType) {
    app.contentmanager.addContentHook('update', contentType, { when: 'post' }, function (contentType, data, next) {

      var userId = usermanager.getCurrentUser()._id;

      database.getDatabase(function (err, db) {
        if (err) {
          logger.log('error', err);
          return next(err)
        }

        // Defensive programming -- just in case
        if (data && data._courseId) {
          // If the _courseId is present, update the last updated date
          db.update('course', { _id: data._courseId }, { updatedAt: new Date(), updatedBy: userId }, function (err) {
            if (err) {
              logger.log('error', err);
              return next(err);
            }
            next(null, data);
          });
        } else {
          next(null, data);
        }

      });

    }.bind(null, contentType));

  });

}

/**
 * overrides base implementation of hasPermission
 *
 * @param {string} action
 * @param {object} contentItem
 * @param {callback} next (function (err, isAllowed))
 */
CourseContent.prototype.hasPermission = function (action, userId, tenantId, contentItem, next) {
  helpers.hasCoursePermission(action, userId, tenantId, contentItem, function (err, isAllowed) {
    if (err) {
      return next(err);
    }
    if (isAllowed) {
      return next(null, true);
    }
    var resource = permissions.buildResourceString(tenantId, `/api/content/course/${contentItem._courseId || '*'}`);
    permissions.hasPermission(userId, action, resource, next);
  });
};

/**
 * implements ContentObject#getModelName
 *
 * @return {string}
 */
CourseContent.prototype.getModelName = function () {
  return 'course';
};

/**
 * implements ContentObject#getChildType
 *
 * @return {string}
 */
CourseContent.prototype.getChildType = function () {
  return ['contentobject', 'config'];
};

/**
 * Overrides base.create
 * @param {object} data
 * @param {callback} next
 */
CourseContent.prototype.create = function (data, next) {
  var self = this;
  var user = usermanager.getCurrentUser();
  var tenantId = user.tenant && user.tenant._id;

  ContentPlugin.prototype.create.call(self, data, function (err, doc) {
    if (err) {
      logger.log('error', err);
      return next(err);
    }

    // grant the creating user full editor permissions
    permissions.createPolicy(user._id, function (err, policy) {
      if (err) {
        logger.log('error', 'there was an error granting editing permissions', err);
      }

      var resource = permissions.buildResourceString(tenantId, '/api/content/course/' + doc._id);
      permissions.addStatement(policy, ['create', 'read', 'update', 'delete'], resource, 'allow', function (err) {
        if (err) {
          logger.log('error', 'there was an error granting editing permissions', err);
        }
        return next(null, doc);
      });
    });
  });
};

/**
 * Overrides base.destroy
 * @param {object} search
 * @param {callback} next
 */
CourseContent.prototype.destroy = function (search, force, next) {
  var self = this;
  var user = app.usermanager.getCurrentUser();
  var tenantId = user.tenant && user.tenant._id;
  // shuffle params
  if ('function' === typeof force) {
    next = force;
    force = false;
  }
  self.hasPermission('delete', user._id, tenantId, search, function (err, isAllowed) {
    if (!isAllowed && !force) {
      return next(new ContentPermissionError());
    }
    // to cascade deletes, we need the _id, which may not be in the search param
    self.retrieve(search, function (error, docs) {
      if (error) {
        return next(error);
      }
      if (!docs || !docs.length) {
        return next(null);
      }
      var resource = permissions.buildResourceString(tenantId, '/api/content/course/*');
      permissions.hasPermission(user._id, 'delete', resource, function (error, canDeleteAll) {
        // Final check before deletion
        if (!canDeleteAll) {
          return next(new ContentPermissionError());
        }
        // Courses use cascading delete
        async.eachSeries(docs, function (doc, cb) {
          self.destroyChildren(doc._id, '_courseId', cb);
        }, function (err) {
          ContentPlugin.prototype.destroy.call(self, search, true, next);
        });
      });
    });
  });
};

/**
 * Duplicate a course
 * @param {array} data
 * @param {callback} cb
 */
function duplicate(data, cb) {
  var self = this;
  var user = app.usermanager.getCurrentUser();

  if (!data) {
    return cb(null);
  }

  // Duplicate item
  CourseContent.prototype.retrieve({ _id: data._id }, function (error, docs) {
    if (error) {
      return cb(error);
    }
    if (docs && docs.length) {
      var doc = docs[0].toObject();
      var oldCourseId = doc._id;

      delete doc._id;

      // As this is a new course, no preview is yet available
      doc._hasPreview = false;

      // New course name
      doc.title = 'Copy of ' + doc.title;

      // Set the current user's ID as the creator
      doc.createdBy = user._id;

      CourseContent.prototype.create(doc, function (error, newCourse) {
        if (error) {
          logger.log('error', error);
          return cb(error);
        }

        var newCourseId = newCourse._id;
        courseId = newCourseId;
        var parentIdMap = [];

        database.getDatabase(function (error, db) {
          if (error) {
            logger.log('error', error);
            return cb(error);
          }

          async.eachSeries(['contentobject', 'article', 'block', 'component', 'config'], function (contenttype, nextContentType) {
            db.retrieve(contenttype, { _courseId: oldCourseId }, function (error, items) {
              if (error) {
                logger.log('error', error);
                return nextContentType(error);
              }

              if (!parentIdMap.length) {
                parentIdMap[oldCourseId] = newCourseId;
              }

              if (contenttype == 'contentobject') {
                items = sortContentObjects(items);
              }

              async.eachSeries(items, function (item, next) {
                var contentData = item.toObject();
                var oldId = contentData._id;
                var oldParentId = contentData._parentId;

                delete contentData._id;
                contentData._courseId = newCourseId;
                contentData._parentId = parentIdMap[oldParentId];

                if (oldParentId && !contentData._parentId) {
                  logger.log('warn', `Cannot copy ${contenttype} '${oldId}', cannot find parent object with ID '${oldParentId}'`);
                  return next();
                }
                return db.create(contenttype, contentData, function (error, newContent) {
                  if (error) {
                    logger.log('error', error);
                    return next(error);
                  }
                  parentIdMap[oldId] = newContent._id;
                  metadata.idMap[oldId] = newContent._id;
                  next();
                });

              }, function (error) {
                if (error) {
                  logger.log('error', error);
                  return cb(error);
                }

                nextContentType(null);
              });
            });
          }, function (error) {
            if (error) {
              logger.log('error', error);
              cb(error, newCourse);
            } else {
              // Assuming there are no errors the assets must set the course assets
              db.retrieve('courseasset', { _courseId: oldCourseId }, function (error, items) {
                if (error) {
                  logger.log('error', error);
                  cb(error, newCourse);
                } else {
                  async.eachSeries(items, function (item, next) {
                    // For each course asset, before inserting the new document
                    // the _courseId, _contentTypeId and _contentTypeParentId must be changed
                    if (parentIdMap[item._contentTypeParentId]) {
                      var courseAsset = item.toObject();
                      delete courseAsset._id;

                      courseAsset._courseId = newCourseId;
                      courseAsset._contentTypeId = parentIdMap[item._contentTypeId];
                      courseAsset._contentTypeParentId = parentIdMap[item._contentTypeParentId];

                      return db.create('courseasset', courseAsset, function (error, newCourseAsset) {
                        if (error) {
                          logger.log('error', error);
                          return next(error);
                        } else {
                          next();
                        }
                      });
                    } else {
                      next();
                    }

                  }, function (error) {
                    if (error) {
                      logger.log('error', error);
                      cb(error);
                    } else {
                      cb(null, newCourse);
                    }
                  });
                }
              });
            }
          }); // end async.eachSeries()
        });
      });
    }
  });
};
async function referenceId(courseId, cb) {
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
  // call back to the course duplicate route
  cb(null);
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

/**
 * Sort contentObjects into correct creation order.
 * (Parent Menus must be created before child Menus/Pages)
 * @param {array} data
 * @param {callback} cb
 */
function sortContentObjects(data) {
  var flat = {},
    root = [],
    list = [],
    counter = 0;

  // Flatten the data
  for (var i = 0; i < data.length; i++) {
    var key = data[i].get('_id');

    flat[key] = {
      _id: data[i].get('_id'),
      _parentId: data[i].get('_parentId'),
      children: []
    };
  }

  // Populate any 'children' container arrays
  for (var i in flat) {
    var parentkey = flat[i]._parentId;

    if (flat[parentkey]) {
      flat[parentkey].children.push(flat[i]);
    }
  }

  // Find the root nodes (no parent found) and create the hierarchy tree from them
  for (var i in flat) {
    var parentkey = flat[i]._parentId;

    if (!flat[parentkey]) {
      root.push(flat[i]);
    }
  }

  for (var i in root) {
    appendToItems(list, root[i], counter);
  }

  for (var i = 0; i < data.length; i++) {
    data[i]._createOrder = list[data[i].get('_id')]._createOrder;
  }

  // Sort items according to creation order
  data.sort(function (a, b) {
    return a._createOrder - b._createOrder;
  });

  return data;
};

/**
 * Recursive append item to list (and set creation order)
 * @param {array} list
 * @param {object} item
 * @param {int} counter
 */
function appendToItems(list, item, counter) {
  counter++;
  item._createOrder = counter;
  list[item._id] = item;

  if (item.children) {
    for (var i in item.children) {
      appendToItems(list, item.children[i], counter);
    }
  }
};

// setup course
initialize();

/**
 * Module exports
 *
 */

exports = module.exports = CourseContent;
