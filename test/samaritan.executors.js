var should = require('should');

var executors = require('../plugins/services/samaritan/actions/executors');
// NOTE: plugins/content/extension (like every content-type plugin, e.g.
// component/bower) runs a module-load-time initialize() that requires a
// booted app - it cannot be require()'d standalone in a unit test. ENABLE_
// PLUGIN/DISABLE_PLUGIN dispatch is therefore covered by real runtime
// validation instead (see the runtime validation report), not here.

function fakeApp(plugins) {
  return {
    usermanager: { getCurrentUser: function() { return { _id: 'user-1' }; } },
    contentmanager: {
      getContentPlugin: function(type, cb) {
        if (!plugins[type]) return cb(new Error('no plugin ' + type));
        cb(null, plugins[type]);
      }
    }
  };
}

describe('samaritan executors', function() {
  it('createCourse creates a course then a root page, returning both ids', function() {
    var created = [];
    var app = fakeApp({
      course: { create: function(data, cb) { created.push('course'); cb(null, { _id: 'course-1' }); }, destroy: function() {} },
      contentobject: { create: function(data, cb) { created.push('page'); data._parentId.should.equal('course-1'); cb(null, { _id: 'page-1' }); } }
    });
    return executors.executeAction(app, { actionType: 'CREATE_COURSE', target: {}, parameters: { title: 'CPR' } }).then(function(result) {
      result.should.eql({ courseId: 'course-1', pageId: 'page-1' });
      created.should.eql(['course', 'page']);
    });
  });

  it('createCourse compensates (deletes the course) if page creation fails', function() {
    var destroyed = false;
    var app = fakeApp({
      course: {
        create: function(data, cb) { cb(null, { _id: 'course-1' }); },
        destroy: function(search, force, cb) { destroyed = search._id === 'course-1'; cb(null); }
      },
      contentobject: { create: function(data, cb) { cb(new Error('page create failed')); } }
    });
    return executors.executeAction(app, { actionType: 'CREATE_COURSE', target: {}, parameters: { title: 'CPR' } }).then(
      function() { throw new Error('expected rejection'); },
      function() { destroyed.should.equal(true); }
    );
  });

  it('createArticle creates under the given parent/course', function() {
    var app = fakeApp({ article: { create: function(data, cb) { cb(null, { _id: 'article-1' }); } } });
    return executors
      .executeAction(app, { actionType: 'CREATE_ARTICLE', target: { parentId: 'page-1', courseId: 'course-1' }, parameters: { title: 'A' } })
      .then(function(result) { result.should.eql({ articleId: 'article-1' }); });
  });

  it('replaceComponent rejects unsupported pairs before touching the database', function() {
    var app = fakeApp({
      component: { retrieve: function(search, opts, cb) { cb(null, [{ _id: 'comp-1', _component: 'mcq' }]); }, create: function() { throw new Error('should not create'); } }
    });
    return executors
      .executeAction(app, { actionType: 'REPLACE_COMPONENT', target: { id: 'comp-1', courseId: 'course-1' }, parameters: { targetComponentType: 'narrative' } })
      .then(
        function() { throw new Error('expected rejection'); },
        function(err) { err.code.should.equal('INVALID_CONFIGURATION'); }
      );
  });

  it('replaceComponent creates the new component then deletes the old one, never the reverse order', function() {
    var order = [];
    var app = fakeApp({
      component: {
        retrieve: function(search, opts, cb) { cb(null, [{ _id: 'comp-1', _component: 'text', title: 'T', body: 'B', _parentId: 'block-1', _courseId: 'course-1' }]); },
        create: function(data, cb) { order.push('create'); cb(null, { _id: 'comp-2' }); },
        destroy: function(search, force, cb) { order.push('destroy'); cb(null); }
      }
    });
    return executors
      .executeAction(app, { actionType: 'REPLACE_COMPONENT', target: { id: 'comp-1', courseId: 'course-1' }, parameters: { targetComponentType: 'narrative', targetComponentTypeId: 'ct-narrative' } })
      .then(function(result) {
        order.should.eql(['create', 'destroy']);
        result.newComponentId.should.equal('comp-2');
        result.removedComponentId.should.equal('comp-1');
      });
  });

  it('rejects an unknown action type without touching any plugin', function() {
    return executors.executeAction(fakeApp({}), { actionType: 'NOT_A_REAL_ACTION', target: {}, parameters: {} }).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('INVALID_CONFIGURATION'); }
    );
  });
});
