var fs = require('fs');
var path = require('path');

var defaultConfigPath = path.join(__dirname, '..', 'conf', 'componentPropertyDefaults.json');

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === 'object') {
    var clone = {};
    Object.keys(value).forEach(function(key) {
      clone[key] = cloneValue(value[key]);
    });
    return clone;
  }

  return value;
}

function loadDefaultConfig() {
  return JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
}

function splitPath(propertyPath) {
  return String(propertyPath || '').split('.').filter(Boolean);
}

function hasNestedValue(target, segments) {
  var current = target;

  for (var index = 0; index < segments.length; index++) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, segments[index])) {
      return false;
    }
    current = current[segments[index]];
  }

  return current !== undefined;
}

function setNestedValue(target, segments, value) {
  var current = target;

  for (var index = 0; index < segments.length - 1; index++) {
    var segment = segments[index];

    if (!current[segment] || typeof current[segment] !== 'object' || Array.isArray(current[segment])) {
      current[segment] = {};
    }

    current = current[segment];
  }

  current[segments[segments.length - 1]] = cloneValue(value);
}

function getMergedDefaults(componentName, config) {
  var source = config || loadDefaultConfig();
  var mergedDefaults = {};

  ['*', componentName].forEach(function(key) {
    if (!key || !source[key] || typeof source[key] !== 'object') {
      return;
    }

    Object.keys(source[key]).forEach(function(propertyPath) {
      mergedDefaults[propertyPath] = cloneValue(source[key][propertyPath]);
    });
  });

  return mergedDefaults;
}

function getSchemaField(schema, propertyPath) {
  var segments = splitPath(propertyPath);
  var current = schema;

  for (var index = 0; index < segments.length; index++) {
    var segment = segments[index];

    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
      continue;
    }

    if (current && current.properties && Object.prototype.hasOwnProperty.call(current.properties, segment)) {
      current = current.properties[segment];
      continue;
    }

    return null;
  }

  return current;
}

function applyDefaultsToObject(target, componentName, config) {
  var defaults = getMergedDefaults(componentName, config);

  Object.keys(defaults).forEach(function(propertyPath) {
    var segments = splitPath(propertyPath);

    // Paths that traverse schema array templates (e.g. _items.items.text)
    // should only be used for schema defaults, not for persisted object writes.
    if (segments.indexOf('items') !== -1) {
      return;
    }

    if (!segments.length || hasNestedValue(target, segments)) {
      return;
    }

    setNestedValue(target, segments, defaults[propertyPath]);
  });

  return target;
}

function applyDefaultsToSchema(schema, componentName, config) {
  var defaults = getMergedDefaults(componentName, config);

  Object.keys(defaults).forEach(function(propertyPath) {
    var field = getSchemaField(schema, propertyPath);

    if (!field || typeof field !== 'object') {
      return;
    }

    field.default = cloneValue(defaults[propertyPath]);
  });

  return schema;
}

module.exports = {
  applyDefaultsToObject: applyDefaultsToObject,
  applyDefaultsToSchema: applyDefaultsToSchema,
  getMergedDefaults: getMergedDefaults,
  getSchemaField: getSchemaField,
  cloneValue: cloneValue,
  loadDefaultConfig: loadDefaultConfig
};