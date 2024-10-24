// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require){
  var OriginView = require('core/views/originView');
  var Origin = require('core/origin');

  var NavigationView = OriginView.extend({
    tagName: 'nav',
    className: 'navigation',

    initialize: function() {
      this.listenTo(Origin, 'login:changed', this.loginChanged);
      this.render();
    },

    events: {
      'click a.navigation-item':'onNavigationItemClicked'
    },

    render: function() {
      Origin.Notify.alert({ type: 'info', text: '<p style="text-align:left">To streamline our extensions, we will soon disable some that are no longer needed. Below is a list of the extensions being replaced, along with their alternatives. Please note that this will not affect existing courses.</p><br/> <ul style="text-align:left"><li>Laerdal Branching → Branching + Trickle</li><li>Laerdal Spoor → Spoor</li><li>Inline Feedback → Tutor with inline option</li></ul>' });
      var data = this.model ? this.model.toJSON() : null;
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
