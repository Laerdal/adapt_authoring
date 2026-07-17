define(function (require) {
  const OriginView = require('core/views/originView');

  return function () {
    OriginView.prototype.onReady = function () {
      this.$('.page-inner .add-control').append(
        '<button class="btn add-article-template">Add article template</button>'
      );
      this.$('.article-inner .add-control').append(
        '<button class="btn add-block-template">Add block template</button>'
      );
      this.$('.block-inner .add-control').append(
        '<button class="btn add-component-template">Add component template</button>'
      );
    };
  };
});
