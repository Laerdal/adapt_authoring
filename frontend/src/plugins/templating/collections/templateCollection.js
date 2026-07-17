// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  const Backbone = require('backbone');
  const TemplateModel = require('../models/templateModel');

  const TemplateCollection = Backbone.Collection.extend({
    model: TemplateModel,

    url: 'api/content/templating',

    dateComparator: function (m) {
      return -m.get('lastUpdated').getTime();
    },
  });

  return TemplateCollection;
});
