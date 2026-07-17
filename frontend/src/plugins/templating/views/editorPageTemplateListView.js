define(function (require) {
  const Origin = require('core/origin');
  const EditorOriginView = require('../../../modules/editor/global/views/editorOriginView');
  const EditorPageTemplateListItemView = require('./editorPageTemplateListItemView');

  const EditorPageTemplateListView = EditorOriginView.extend(
    {
      className: 'editor-template-list',
      tagName: 'div',

      events: {
        click: 'onOverlayClicked',
        'click .editor-template-list-sidebar-exit, .click-capture': 'closeView',
        'keyup .editor-template-list-sidebar-search input': 'onSearchKeyup',
      },

      preRender: function (options) {
        $('html').css('overflow-y', 'hidden');

        this.listenTo(Origin, {
          'editorTemplateListView:remove': this.remove,
          'window:resize': this.onScreenResize,
        });

        this.setupCollection();
        this.setupFilters();

        this.$parentElement = options.$parentElement;
        this.parentView = options.parentView;
      },

      setupCollection: function () {
        //
      },

      setupFilters: function () {
        this.availablePositions = {
          left: false,
          right: false,
          full: false,
        };

        _.each(
          this.model.get('layoutOptions'),
          function (layoutOption) {
            switch (layoutOption.type) {
              case 'left':
                this.availablePositions.left = true;
                break;
              case 'right':
                this.availablePositions.right = true;
                break;
              case 'full':
                this.availablePositions.full = true;
                break;
            }
          },
          this
        );

        this.model.set('_availablePosition', this.availablePositions);
      },

      postRender: function () {
        this.renderTemplateList();
        this.headerHeight = this.$(
          '.editor-component-list-sidebar-header'
        ).height();
        $(window).resize();
        // move bar into place and animate in
        this.$el
          .css({ right: this.$('.editor-template-list-sidebar').width() * -1 })
          .velocity({ right: 0 }, { duration: 400, easing: 'easeOutQuart' });

        this.$('.editor-template-list-sidebar-search-field input').focus();
      },

      closeView: function () {
        var self = this;
        this.$el.velocity(
          { right: this.$('.editor-template-list-sidebar').width() * -1 },
          {
            duration: 400,
            easing: 'easeOutQuart',
            complete: function onAnimOut() {
              $('html').css('overflow-y', '');
              self.remove();
            },
          }
        );
      },

      renderTemplateList: function () {
        Origin.trigger('editorTemplateListView:removeSubviews');

        this.collection.each(function (templateModel) {
          const properties = templateModel.get('properties');
          let availablePositions = _.clone(this.availablePositions);

          if (properties && properties.hasOwnProperty('_supportedLayout')) {
            const supportedLayout = properties._supportedLayout.enum;

            // Prune the available positions
            if (_.indexOf(supportedLayout, 'half-width') == -1) {
              availablePositions.left = false;
              availablePositions.right = false;
            }

            if (_.indexOf(supportedLayout, 'full-width') == -1) {
              availablePositions.full = false;
            }
          }

          const contentType = templateModel.get('referenceType');

          // Pages, Articles and Blocks can only be full width
          if (contentType != 'component') {
            availablePositions = {
              left: false,
              right: false,
              full: true,
            };
          }

          this.$('.editor-template-list-sidebar-list').append(
            new EditorPageTemplateListItemView({
              model: templateModel,
              availablePositions: availablePositions,
              _parentId: this.model.get('_parentId'),
              $parentElement: this.$parentElement,
              parentView: this.parentView,
              searchTerms: templateModel.attributes.title.toLowerCase(),
            }).$el
          );
        }, this);
      },

      onOverlayClicked: function (event) {
        if ($(event.target).hasClass('editor-template-list')) {
          Origin.trigger('editorTemplateListView:removeSubviews');
          $('html').css('overflow-y', '');
          this.remove();
        }
      },

      onSearchKeyup: function (event) {
        var searchValue = $(event.currentTarget).val();
        Origin.trigger('editorTemplateListView:searchKeyup', searchValue);
      },

      onScreenResize: function (windowWidth, windowHeight) {
        this.$('.editor-template-list-sidebar-list').height(
          (windowHeight - this.headerHeight) - '148'
        );
      },
    },
    {
      template: 'editorPageTemplateList',
    }
  );

  return EditorPageTemplateListView;
});
