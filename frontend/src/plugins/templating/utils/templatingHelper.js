define(function (require) {
  const Origin = require('core/origin');
  const EditorPageTemplateListView = require('../views/editorPageTemplateListView');
  const SaveNewTemplateView = require('../views/saveNewTemplateView');

  function openSaveTemplateModal(editorPageContentView) {

    const options = {
      onUpdate: async function (data) {
        try {
          const title = data.name;
          const description = data.description;
          const clipboardId = await triggerClipboardCopy(
            editorPageContentView.model
          );
          const copiedData = await fetchClipboardData(clipboardId);
          const templateData = sanitizeTemplateData({
            title,
            description,
            copiedData,
            isShared: data._isShared,
            shareWithUsers: data._shareWithUsers,
          });
          const result = await saveTemplateData(templateData);

          Origin.Notify.snackbar('Template saved');
        } catch (error) {
          console.error('Error:', error);
          Origin.Notify.snackbar('Error saving template');
        }
      },
      onCancel: function () {
        console.log('cancel');
      },
      model: editorPageContentView.model,
    };

    Origin.trigger(
      'modal:open',
      SaveNewTemplateView,
      options,
      editorPageContentView
    );
  }

  async function triggerClipboardCopy(model) {
    console.log('triggerClipboardCopy');
    const postData = {
      objectId: model.get('_id'),
      courseId: Origin.editor.data.course.get('_id'),
      referenceType: model._siblingTypes,
    };

    const response = await fetch('api/content/clipboard/copy', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });
    const result = await response.json();
    if (result.success) {
      return result.clipboardId;
    } else {
      throw new Error(result.message);
    }
  }

  async function fetchClipboardData(clipboardId) {
    const response = await fetch('api/content/clipboard/' + clipboardId);
    const result = await response.json();
    return result;
  }

  function sanitizeTemplateData({ title, description, copiedData, isShared, shareWithUsers }) {
    const templateData = _.clone(copiedData);
    templateData.title = title || `New template title`;
    templateData.description = description || `New template description`;
    templateData._referenceId = templateData._id;
    // Sharing — mirrors the course _isShared / _shareWithUsers model so the new
    // Studio can list templates under "My Templates" / "Shared Templates".
    templateData._isShared = !!isShared;
    templateData._shareWithUsers = Array.isArray(shareWithUsers) ? shareWithUsers : [];
    delete templateData._id;
    return templateData;
  }

  async function saveTemplateData(templateData) {
    const response = await fetch('api/content/templating', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });
    const result = await response.json();

    return result;
  }

  function handleSaveTemplate() {
    const context = this;
    openSaveTemplateModal(context);
  }

  async function showTemplateList(self, templateType) {
    console.log('showTemplateList');

    let layoutOptions = self.model.get('layoutOptions');
    if (!layoutOptions) {
      layoutOptions = {
        full: { type: 'full', name: 'app.layoutfull', pasteZoneRenderOrder: 1 },
        left: { type: 'left', name: 'app.layoutleft', pasteZoneRenderOrder: 2 },
        right: {
          type: 'right',
          name: 'app.layoutright',
          pasteZoneRenderOrder: 3,
        },
      };
    }
    const templateSelectModel = new Backbone.Model({
      title: Origin.l10n.t('app.addcomponenttemplate'),
      body: Origin.l10n.t('app.pleaseselecttemplate'),
      _parentId: self.model.get('_id'),
      layoutOptions: layoutOptions,
    });
    const templateCollection = await getTemplateList(templateType);
    $('body').append(
      new EditorPageTemplateListView({
        model: templateSelectModel,
        collection: new Backbone.Collection(templateCollection),
        $parentElement: self.$el,
        parentView: self,
      }).$el
    );
  }

  async function getTemplateList(templateType) {
    const userId = Origin.sessionModel.get('id');
    const url = `api/content/templating?referenceType=${templateType}&createdBy=${userId}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data || data.length < 1) {
        return [];
      }
      return data;
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function deleteTemplateList(idValue, courseId, referenceId, referenceType) {
    const response = await fetch(
      `api/content/templating/${idValue}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _courseId: courseId,
          referenceType: referenceType,
          _referenceId: referenceId,
        }),
      }
    );

    const result = await response.json();
    if (result.success) {
      console.log('Template deleted');
    } else {
      console.log('Error adding template', result);
    }
    console.log('deleteTemplateList');
  }

  // Templating helper module
  return {
    handleSaveTemplate,
    showTemplateList,
    getTemplateList,
    deleteTemplateList,
  };
});
