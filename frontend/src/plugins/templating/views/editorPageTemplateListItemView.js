// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  const Origin = require('core/origin');
  const EditorOriginView = require('../../../modules/editor/global/views/editorOriginView');

  const EditorPageTemplateListItemView = EditorOriginView.extend(
    {
      className: 'editor-template-list-item',
      tagName: 'div',

      events: {
        click: 'onItemClicked',
        'click div.editor-template-list-item-overlay-inner > a':
          'onButtonClicked',
      },

      preRender: function (options) {
        this.listenTo(Origin, {
          'editorTemplateListView:removeSubviews': this.remove,
          'editorTemplateListItemView:deselect': this.deselectItem,
          'editorTemplateListView:searchKeyup': this.onSearchValueChanged,
        });

        this.model.set('availablePositions', options.availablePositions);

        this._parentId = options._parentId;
        this.$parentElement = options.$parentElement;
        this.parentView = options.parentView;
        this.searchTerms = options.searchTerms;
      },

      postRender: function () {
        if (this.model.get('_isAvailableInEditor') == false) {
          this.$el.addClass('restricted');
        }
      },

      onItemClicked: function (event) {
        event && event.preventDefault();

        Origin.trigger('editorTemplateListItemView:deselect');

        this.$el.addClass('selected');
        this.$('.editor-template-list-item-overlay').removeClass(
          'display-none'
        );
      },

      deselectItem: function () {
        $('.editor-template-list-item').removeClass('selected');
        this.$('.editor-template-list-item-overlay').addClass('display-none');
      },

      onSearchValueChanged: function (searchValue) {
        var isSearchTerms =
          this.searchTerms.indexOf(searchValue.toLowerCase()) > -1 ||
          searchValue.length === 0;
        this.$el.toggleClass('display-none', !isSearchTerms);
      },

      onButtonClicked: function (event) {
        event && event.preventDefault();
        const target = event.currentTarget;
        const layout = target.getAttribute('data-position');
        this.addTemplate(layout);
      },

      addTemplate: async function (layout) {
        Origin.trigger('editorTemplateListView:remove');
        
        if (this.model.get('referenceType') === 'contentobject') {
          this.sortOrders = this.parentView.models.length + 1;
        } else if (this.model.get('referenceType') === 'article') {
          this.sortOrders = this.parentView.childrenRenderedCount + 1;
        } else if (this.model.get('referenceType') === 'block') {
          this.sortOrders = this.parentView.$el.find('.block').length + 1;
        }
        else {
          this.sortOrders = null;
        }
        
        const data = {
          objectId: this.model.get('_id'),
          parentId: this._parentId,
          layout: layout,
          sortOrder: this.sortOrders,
          courseId: Origin.editor.data.course.get('_id'),
        };

        const response = await fetch('api/templating/paste', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();
        if (result.success) {
          // Refresh the view with the newly added template
          if (this.parentView && this.parentView.refresh) {
            this.parentView.refresh();
          }
        } else {
          console.log('Error adding template', result);
        }
      },
    },
    {
      template: 'editorPageTemplateListItem',
    }
  );

  return EditorPageTemplateListItemView;
});