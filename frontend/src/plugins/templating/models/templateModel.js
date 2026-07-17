// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  const Backbone = require('backbone');

  const TemplateModel = Backbone.Model.extend({
    idAttribute: '_id',
    urlRoot: 'api/content/templating',
  });

  return TemplateModel;
});
