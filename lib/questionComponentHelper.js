// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
/**
 * Detects whether an Adapt component plugin extends the framework QuestionModel chain
 * by scanning its js/ source files at install time.
 */

var fs = require('fs');
var path = require('path');

var QUESTION_MODEL_PATTERN = /(?:extends\s+\w*Question\w*|from\s+['"]core\/js\/models\/(?:items)?questionModel['"])/i;

/**
 * @param {string} pluginDir absolute path to the installed component package root
 * @returns {boolean}
 */
function isQuestionComponentPlugin(pluginDir) {
  var jsDir = path.join(pluginDir, 'js');

  if (!fs.existsSync(jsDir)) {
    return false;
  }

  try {
    return fs.readdirSync(jsDir)
      .filter(function(file) {
        if (!file.endsWith('.js')) return false;
        try {
          return fs.statSync(path.join(jsDir, file)).isFile();
        } catch (e) {
          return false;
        }
      })
      .some(function(file) {
        try {
          return QUESTION_MODEL_PATTERN.test(
            fs.readFileSync(path.join(jsDir, file), 'utf8')
          );
        } catch (e) {
          return false;
        }
      });
  } catch (e) {
    return false;
  }
}

// List of extension attributes that should only appear on question
// components — extend this list if more such extensions are added.
var QUESTION_ONLY_EXTENSION_ATTRS = ['_questionStateGraphic'];

/**
 * @param {object} schema componenttype record or generated component schema
 * @returns {boolean}
 */
function isQuestionComponentSchemaRecord(schema) {
  if (!schema) {
    return false;
  }

  if (schema._isQuestionType === true) {
    return true;
  }

  if (schema._doc && schema._doc._isQuestionType === true) {
    return true;
  }

  // Fallback for componenttypes installed before _isQuestionType was persisted.
  // Walk nested properties to reach the component field definitions on a componenttype record.
  var componentProps = schema.properties &&
    schema.properties.properties &&
    schema.properties.properties.properties;

  if (!componentProps) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(componentProps, '_questionWeight');
}

/**
 * @param {object} extensionProperties merged extension fields for a component schema
 * @param {object} schema component schema record
 * @returns {object}
 */
function filterQuestionOnlyExtensionProperties(extensionProperties, schema) {
  if (!extensionProperties || isQuestionComponentSchemaRecord(schema)) {
    return extensionProperties;
  }

  var filtered = Object.assign({}, extensionProperties);

  QUESTION_ONLY_EXTENSION_ATTRS.forEach(function(attr) {
    delete filtered[attr];
  });

  return filtered;
}

module.exports = {
  isQuestionComponentPlugin: isQuestionComponentPlugin,
  isQuestionComponentSchemaRecord: isQuestionComponentSchemaRecord,
  filterQuestionOnlyExtensionProperties: filterQuestionOnlyExtensionProperties,
  QUESTION_ONLY_EXTENSION_ATTRS: QUESTION_ONLY_EXTENSION_ATTRS
};
