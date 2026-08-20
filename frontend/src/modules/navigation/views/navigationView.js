// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require){
  var OriginView = require('core/views/originView');
  var Origin = require('core/origin');

  var NavigationView = OriginView.extend({
    tagName: 'nav',
    className: 'navigation',

    initialize: function() {
      this.listenTo(Origin, 'login:changed', this.loginChanged);
      this.listenTo(Origin, 'location:change', this.render);
      this.render();
    },

    events: {
      'click a.navigation-item':'onNavigationItemClicked'
    },

    render: function() {
      var data = this.model ? this.model.toJSON() : {};
      data = $.extend({}, data, {
        inEditor: Origin.location && Origin.location.module === 'editor'
      });
      var template = Handlebars.templates[this.constructor.template];
      this.$el.html(template(data));
      return this;
    },

    loginChanged: function() {
      this.render();
    },

    onNavigationItemClicked: function(event) {
      event.preventDefault();
      event.stopPropagation();
      Origin.trigger('navigation:' + $(event.currentTarget).attr('data-event'));
    }
  }, {
    template: 'navigation'
  });

  return NavigationView;
});
