// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const async = require('async');
const database = require('../../../../lib/database');
const logger = require('../../../../lib/logger');

// collection name -> plugin "type" label used in the manifest
const TYPE_COLLECTIONS = [
  { attribute: '_theme', collection: 'themetype', type: 'theme', multi: false },
  { attribute: '_menu', collection: 'menutype', type: 'menu', multi: false },
  { attribute: '_enabledComponents', collection: 'componenttype', type: 'component', multi: true },
  { attribute: '_enabledExtensions', collection: 'extensiontype', type: 'extension', multi: true }
];

/**
 * Extracts the plugin name(s) referenced by a config attribute.
 * Mirrors the shape handling already used by
 * lib/outputmanager.js's generateIncludedPlugins (string, or
 * object/array of {name}).
 */
function extractNames(val) {
  if (val === undefined || val === null) {
    return [];
  }
  if (typeof val === 'string') {
    return [val];
  }
  var names = [];
  for (var i in val) {
    if (val[i] && typeof val[i].name !== 'undefined') {
      names.push(val[i].name);
    }
  }
  return names;
}

/**
 * Builds the `pluginDependencies` manifest field: every theme/menu/
 * component/extension the course actually uses, with its DB-recorded
 * version where available.
 *
 * @param {object} adaptPlugin - resolved 'adapt' OutputPlugin instance
 * @param {string} courseId
 * @param {function(Error, Array)} next
 */
function buildPluginDependencies(adaptPlugin, courseId, next) {
  adaptPlugin.getCourseConfigJSON(courseId, function(error, result) {
    if (error) {
      return next(error);
    }
    var config = result && result.config && result.config[0];
    if (!config) {
      return next(new Error('apkg: unable to retrieve course config for plugin resolution'));
    }

    database.getDatabase(function(error, db) {
      if (error) {
        return next(error);
      }

      var tasks = {};
      TYPE_COLLECTIONS.forEach(function(info) {
        var names = extractNames(config[info.attribute]);
        tasks[info.type] = function(cb) {
          if (!names.length) {
            return cb(null, { names: names, docs: [] });
          }
          var criteria = info.multi ? { name: { $in: names } } : { name: names[0] };
          db.retrieve(info.collection, criteria, {}, function(error, docs) {
            if (error) {
              return cb(error);
            }
            cb(null, { names: names, docs: docs || [] });
          });
        };
      });

      async.parallel(tasks, function(error, results) {
        if (error) {
          return next(error);
        }

        var dependencies = [];
        TYPE_COLLECTIONS.forEach(function(info) {
          var result = results[info.type];
          result.names.forEach(function(name) {
            var doc = result.docs.find(function(d) { return d.name === name; });
            if (!doc) {
              logger.log('warn', 'apkg: no ' + info.collection + ' record found for plugin "' + name + '" used by course ' + courseId);
            }
            dependencies.push({
              name: name,
              type: info.type,
              version: doc ? doc.version : null,
              displayName: doc ? doc.displayName : name
            });
          });
        });

        next(null, dependencies);
      });
    });
  });
}

module.exports = buildPluginDependencies;
