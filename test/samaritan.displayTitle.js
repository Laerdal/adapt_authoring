var should = require('should');

var executors = require('../plugins/services/samaritan/actions/executors');

// Learners see displayTitle, not title. Left unset, the schema/template fills in a
// placeholder ("New Menu/Page Title", "Enter section title"), so every create path
// must write a displayTitle too.

function fakeApp() {
  var written = {};
  var parent = function(type) {
    return { retrieve: function(search, opts, cb) { cb(null, [{ _id: search._id, _type: 'page', _courseId: 'course-1' }]); } };
  };
  var plugins = {
    course: { create: function(data, cb) { written.course = data; cb(null, { _id: 'course-1' }); }, destroy: function() {} },
    contentobject: Object.assign(parent(), { create: function(data, cb) { written[data._type || 'page'] = data; cb(null, { _id: 'page-1' }); } }),
    article: Object.assign(parent(), { create: function(data, cb) { written.article = data; cb(null, { _id: 'article-1' }); } }),
    block: Object.assign(parent(), { create: function(data, cb) { written.block = data; cb(null, { _id: 'block-1' }); } }),
    component: {
      retrieve: function(search, opts, cb) { cb(null, []); },
      create: function(data, cb) { written.component = data; cb(null, { _id: 'comp-1' }); }
    }
  };
  var app = {
    usermanager: { getCurrentUser: function() { return { _id: 'user-1' }; } },
    contentmanager: {
      getContentPlugin: function(type, cb) { plugins[type] ? cb(null, plugins[type]) : cb(new Error('no plugin ' + type)); }
    }
  };
  return { app: app, written: written };
}

function run(actionType, target, parameters) {
  var f = fakeApp();
  return executors.executeAction(f.app, { actionType: actionType, target: target, parameters: parameters }).then(function() { return f.written; });
}

describe('samaritan displayTitle', function() {
  it('CREATE_COURSE sets displayTitle on the course and its root page', function() {
    return run('CREATE_COURSE', {}, { title: 'File Naming' }).then(function(w) {
      w.course.displayTitle.should.equal('File Naming');
      w.page.displayTitle.should.equal('File Naming');
    });
  });

  it('CREATE_PAGE sets displayTitle to the title', function() {
    return run('CREATE_PAGE', { courseId: 'course-1' }, { title: 'Knowledge check' }).then(function(w) {
      w.page.title.should.equal('Knowledge check');
      w.page.displayTitle.should.equal('Knowledge check');
    });
  });

  it('CREATE_ARTICLE and CREATE_BLOCK set displayTitle to the title', function() {
    return run('CREATE_ARTICLE', { parentId: 'page-1', courseId: 'course-1' }, { title: 'Section A' })
      .then(function(w) { w.article.displayTitle.should.equal('Section A'); })
      .then(function() { return run('CREATE_BLOCK', { parentId: 'article-1', courseId: 'course-1' }, { title: 'Block A' }); })
      .then(function(w) { w.block.displayTitle.should.equal('Block A'); });
  });

  it('ADD_COMPONENT defaults displayTitle to the title', function() {
    return run('ADD_COMPONENT', { parentId: 'block-1', courseId: 'course-1' }, { _component: 'text', _componentType: 't1', title: 'Descriptive filenames', body: '<p>x</p>' }).then(function(w) {
      w.component.displayTitle.should.equal('Descriptive filenames');
    });
  });

  it('ADD_COMPONENT keeps an explicit displayTitle, including an empty one', function() {
    return run('ADD_COMPONENT', { parentId: 'block-1', courseId: 'course-1' }, { _component: 'mcq', _componentType: 't2', title: 'Check Your Understanding: X', displayTitle: 'Which is best?' })
      .then(function(w) { w.component.displayTitle.should.equal('Which is best?'); })
      .then(function() { return run('ADD_COMPONENT', { parentId: 'block-1', courseId: 'course-1' }, { _component: 'text', _componentType: 't1', title: 'New Text Component', displayTitle: '' }); })
      .then(function(w) { w.component.displayTitle.should.equal(''); });
  });
});
