// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require){
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  var ArticleModel = require('core/models/articleModel');
  var ContentCollection = require('core/collections/contentCollection');
  var EditorOriginView = require('../../global/views/editorOriginView');
  var EditorPageArticleView = require('./editorPageArticleView');
  var EditorPasteZoneView = require('../../global/views/editorPasteZoneView');

  var EditorPageView = EditorOriginView.extend({
    className: 'page',
    tagName: 'div',
    childrenRenderedCount: 0,

    events: _.extend({}, EditorOriginView.prototype.events, {
      'click .add-article': 'addNewArticle',
      'click .page-edit-button': 'openContextMenu',
      'dblclick .page-detail': 'loadPageEdit',
      'click .paste-cancel': 'onPasteCancel'
    }),

    preRender: function() {
      Origin.editor.blockCount = 0;
      var id = this.model.get('_id');
      var originEvents = {
        'editorView:removeSubViews': this.remove,
        'pageView:itemAnimated': this.evaluateChildStatus
      };
      originEvents['editorView:moveArticle:' + id] = this.render;
      originEvents['editorView:pasted:' + id] = this.render;
      this.listenTo(Origin, originEvents);

      Origin.options.addItems([
        {
          title: Origin.l10n.t('app.collapseAllArticles'),
          icon: 'minus',
          callbackEvent: 'editorView:collapseArticle:collapse',
          value: 'collapse',
          group: 'collapseArticle',
        },
        {
          title: Origin.l10n.t('app.expandAllArticles'),
          icon: 'plus',
          callbackEvent: 'editorView:collapseArticle:expand',
          value: 'expand',
          group: 'collapseArticle',
        }
      ]);

      this._onScroll = _.bind(_.throttle(this.onScroll, 400), this);
    },

    render: function() {
      var returnVal = EditorOriginView.prototype.render.apply(this, arguments);

      this.addArticleViews();

      return returnVal;
    },

    evaluateChildStatus: function() {
      this.childrenRenderedCount++;

      if (this.childrenRenderedCount < Origin.editor.blockCount) return;
      this.allChildrenRendered();
    },

    postRender: function() {
      this.setupScrollListener();
    },

    addArticleViews: function() {
      this.$('.page-articles').empty();
      Origin.trigger('editorPageView:removePageSubViews');
      // Insert the 'pre' paste zone for articles
      var prePasteArticle = new ArticleModel({
        _parentId: this.model.get('_id'),
        _type: 'article',
        _pasteZoneSortOrder: 1
      });
      this.$('.page-articles').append(new EditorPasteZoneView({ model: prePasteArticle }).$el);

      // ADAPT-3618: Prefetch ALL components for this course in parallel with the
      // article fetch. Both requests fire immediately; whichever finishes last
      // triggers rendering. This eliminates the N+1 pattern where each block
      // issued its own GET /api/content/component?_parentId=<id> request.
      var self = this;
      var courseId = Origin.editor.data.course.get('_id');
      var componentsDone = false;
      var articlesDone = false;
      var componentCache = null;
      var articleChildren = null;

      function tryRenderArticles() {
        if (!componentsDone || !articlesDone) return;
        // Guard: view was removed (user navigated away) before both fetches completed.
        // Without this, addArticleView appends to a detached DOM node, which causes
        // React's reconciler to crash with "removeChild: not a child of this node".
        if (self._isRemoved) return;
        self.$('.page-articles-loading').remove();
        self._componentCache = componentCache;
        for (var i = 0, count = articleChildren.length; i < count; i++) {
          if (articleChildren[i].get('_type') !== 'article') continue;
          self.addArticleView(articleChildren[i]);
        }
      }

      // Show loading indicator while both fetches are in-flight
      self.$('.page-articles').append(
        '<div class="page-articles-loading">' +
          '<div class="page-articles-loading-anim">' +
            '<div class="circle1"></div><div class="circle2"></div><div class="circle3"></div>' +
          '</div>' +
          '<p class="page-articles-loading-msg">' + Origin.l10n.t('app.loading') + '</p>' +
        '</div>'
      );

      // Fire component prefetch (no-op on error — block views fall back to fetchChildren)
      (new ContentCollection(null, { _type: 'component', _courseId: courseId })).fetch({
        success: function(col) {
          componentCache = _.groupBy(col.models, function(m) {
            return m.get('_parentId').toString();
          });
          componentsDone = true;
          tryRenderArticles();
        },
        error: function() {
          componentsDone = true;
          tryRenderArticles();
        }
      });

      // Fire article fetch in parallel
      this.model.fetchChildren(function(children) {
        articleChildren = children;
        articlesDone = true;
        tryRenderArticles();
      });
    },

    addArticleView: function(articleModel, scrollIntoView) {
      scrollIntoView = scrollIntoView || false;

      var newArticleView = new EditorPageArticleView({ model: articleModel, componentCache: this._componentCache });
      var sortOrder = articleModel.get('_sortOrder');
      var $articles = this.$('.page-articles .article');
      var index = sortOrder > 0 ? sortOrder-1 : undefined;
      var shouldAppend = index === undefined || index >= $articles.length || $articles.length === 0;

      if(shouldAppend) { // add to the end of the article
        this.$('.page-articles').append(newArticleView.$el);
      } else { // 'splice' block into the new position
        $($articles[index]).before(newArticleView.$el);
      }

      if (scrollIntoView) {
        $.scrollTo(newArticleView.$el, 200);
      }
      // Increment the 'sortOrder' property
      articleModel.set('_pasteZoneSortOrder', sortOrder + 1);
      // Post-article paste zone - sort order of placeholder will be one greater
      this.$('.page-articles').append(new EditorPasteZoneView({ model: articleModel }).$el);
      return newArticleView;
    },

    addNewArticle: async function(event) {
      const currentUserRole = await Origin.getCurrentUserRole();
      if (currentUserRole === 'Authenticated User') {
        Origin.Notify.alert({
          type: 'error',
          text: 'You do not have permission to edit or delete the courses'
        });
      } else {
      event && event.preventDefault();
      (new ArticleModel()).save({
        _parentId: this.model.get('_id'),
        _courseId: Origin.editor.data.course.get('_id'),
        _type:'article'
      }, {
        success: _.bind(function(model, response, options) {
          var articleView = this.addArticleView(model);
          articleView._skipRender = true; // prevent render of blocks in postRender
          articleView.addBlock();
        }, this),
        error: function() {
          Origin.Notify.alert({
            type: 'error',
            text: Origin.l10n.t('app.erroraddingarticle')
          });
        }
      });
    }
    },

    getCurrentUserRole: async function () {
      const response = await fetch('/api/user/me');
      const result = await response.json();
      return result.rolesAsName[0];
    },
    loadPageEdit: function(event) {
      event && event.preventDefault();
      var courseId = this.model.get('_courseId');
      var id = this.model.get('_id');
       Origin.router.navigateTo('editor/' + courseId + '/page/' + id + '/edit');
    },

    // TODO fragile HACK, refactor context menu code to allow what I want to do later...
    openContextMenu: function(event) {
      if(!event) return console.log('Error: needs a current target to attach the menu to...');
      event.preventDefault();
      event.stopPropagation();

      var fakeModel = new Backbone.Model({ _id: this.model.get('_id'), _type: 'page-min' });
      var fakeView = new Backbone.View({ model: fakeModel });

      this.listenTo(fakeView, {
        'contextMenu:page-min:edit': this.loadPageEdit,
        'contextMenu:page-min:copyID': this.onCopyID
      });
      Origin.trigger('contextMenu:open', fakeView, event);
    },

    onCutArticle: function(view) {
      this.once('pageView:postRender', view.showPasteZones);
      this.render();
    },

    setupScrollListener: function() {
      $('.contentPane').on('scroll', this._onScroll);
    },

    onScroll: function(event) {
      var scrollPos = event.currentTarget.scrollTop;
      Origin.editor.scrollTo = scrollPos;
    },

    removeScrollListener: function() {
      $('.contentPane').off('scroll', this._onScroll);
    },

    allChildrenRendered: function() {
      if (Origin.editor.scrollTo > 0) {
        this.removeScrollListener();
      }
      $('.contentPane').scrollTo(Origin.editor.scrollTo, {
        duration: 200,
        onAfter: _.bind(function() {
          this.setupScrollListener();
        }, this)
      });
    },

    remove: function() {
      this._isRemoved = true;
      this.removeScrollListener();
      EditorOriginView.prototype.remove.apply(this, arguments);
    }
  }, {
    template: 'editorPage'
  });

  return EditorPageView;
});
