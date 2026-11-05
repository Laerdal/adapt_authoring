var should = require('should');

var executors = require('../plugins/services/samaritan/actions/executors');
var orchestrator = require('../plugins/services/samaritan/actions/orchestrator');
var { orderByDependencies } = require('../plugins/services/samaritan/actions/planOrder');
var { planTextToNarrative } = require('../plugins/services/samaritan/actions/migrations/textToNarrative');
var provider = require('../plugins/services/samaritan/ai/azureProvider');
var reasoner = require('../plugins/services/samaritan/reasoning/reasoner');
var promptComposer = require('../plugins/services/samaritan/ai/promptComposer');

function fakeApp(plugins, extra) {
  return {
    usermanager: { getCurrentUser: function() { return { _id: 'user-1' }; } },
    contentmanager: Object.assign({
      getContentPlugin: function(type, cb) {
        if (!plugins[type]) return cb(new Error('no plugin ' + type));
        cb(null, plugins[type]);
      }
    }, extra || {})
  };
}

function parentPlugin(doc) {
  return { retrieve: function(search, opts, cb) { cb(null, doc ? [doc] : []); } };
}

var originalExecute = executors.executeAction;
var originalComplete = provider.complete;
afterEach(function() {
  executors.executeAction = originalExecute;
  provider.complete = originalComplete;
});

describe('samaritan review fixes: execution safety', function() {
  var articleAction = { actionType: 'CREATE_ARTICLE', target: { parentId: 'page-1', courseId: 'course-1' }, parameters: { title: 'A' } };

  it('refuses to create under a parent that no longer exists', function() {
    var app = fakeApp({ contentobject: parentPlugin(null), article: { create: function() { throw new Error('should not create'); } } });
    return executors.executeAction(app, articleAction).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('NOT_FOUND'); }
    );
  });

  it('refuses a parent that belongs to a different course', function() {
    var app = fakeApp({ contentobject: parentPlugin({ _id: 'page-1', _type: 'page', _courseId: 'other-course' }), article: { create: function() { throw new Error('should not create'); } } });
    return executors.executeAction(app, articleAction).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('COURSE_MISMATCH'); }
    );
  });

  it('refuses to add an article to a menu', function() {
    var app = fakeApp({ contentobject: parentPlugin({ _id: 'page-1', _type: 'menu', _courseId: 'course-1' }), article: { create: function() { throw new Error('should not create'); } } });
    return executors.executeAction(app, articleAction).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('INVALID_CONFIGURATION'); }
    );
  });

  it('creates content through the host content manager so its create hooks run', function() {
    var viaManager = [];
    var app = fakeApp(
      { contentobject: parentPlugin({ _id: 'page-1', _type: 'page', _courseId: 'course-1' }), article: { create: function() { throw new Error('raw plugin create must not be used'); } } },
      { create: function(type, data, cb) { viaManager.push(type); cb(null, { _id: 'article-9' }); } }
    );
    return executors.executeAction(app, articleAction).then(function(result) {
      viaManager.should.eql(['article']);
      result.articleId.should.equal('article-9');
    });
  });

  it('keeps the created component id when the follow-up read fails', function() {
    var reads = 0;
    var component = {
      retrieve: function(search, opts, cb) {
        reads++;
        if (reads === 1) return cb(null, []); // siblings before the write
        cb(new Error('read failed'));
      }
    };
    var app = fakeApp(
      { block: parentPlugin({ _id: 'block-1', _courseId: 'course-1' }), component: component },
      { create: function(type, data, cb) { cb(null, { _id: 'comp-1' }); } }
    );
    return executors
      .executeAction(app, { actionType: 'ADD_COMPONENT', target: { parentId: 'block-1', courseId: 'course-1' }, parameters: { _component: 'text', _componentType: 'ct', title: 'T' } })
      .then(function(result) { result.componentId.should.equal('comp-1'); });
  });

  it('createCourse reports the course id as partial state when its cleanup also fails', function() {
    var app = fakeApp({
      course: { create: function(data, cb) { cb(null, { _id: 'course-1' }); }, destroy: function(search, force, cb) { cb(new Error('delete failed')); } },
      contentobject: { create: function(data, cb) { cb(new Error('page create failed')); } }
    });
    return executors.executeAction(app, { actionType: 'CREATE_COURSE', target: {}, parameters: { title: 'CPR' } }).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.partial.should.containEql({ courseId: 'course-1', cleanupFailed: true }); }
    );
  });
});

describe('samaritan review fixes: orchestrator honesty', function() {
  var plan = [
    { actionId: 'a', actionType: 'CREATE_ARTICLE', target: {}, parameters: {} },
    { actionId: 'b', actionType: 'CREATE_BLOCK', target: {}, parameters: {} }
  ];

  it('reports partial_failure, not rolled_back, when a compensating delete fails', function() {
    executors.executeAction = function(app, action) {
      if (action.actionId === 'b') return Promise.reject(new Error('boom'));
      return Promise.resolve({ articleId: 'article-1' });
    };
    var app = fakeApp({ article: { destroy: function(search, force, cb) { cb(new Error('delete failed')); } } });
    return orchestrator.executePlan(app, plan, function() {}).then(function(outcome) {
      outcome.status.should.equal('partial_failure');
      should.exist(outcome.compensationError);
    });
  });

  it('reports partial_failure without attempting a rollback when an executor left partial state', function() {
    var destroyed = false;
    executors.executeAction = function(app, action) {
      if (action.actionId === 'a') return Promise.resolve({ articleId: 'article-1' });
      var err = new Error('boom');
      err.partial = { courseId: 'c1' };
      return Promise.reject(err);
    };
    var app = fakeApp({ article: { destroy: function(search, force, cb) { destroyed = true; cb(null); } } });
    return orchestrator.executePlan(app, plan, function() {}).then(function(outcome) {
      outcome.status.should.equal('partial_failure');
      destroyed.should.equal(false);
    });
  });
});

describe('samaritan review fixes: plan ordering', function() {
  function record(actionId, dependsOn) { return { actionId: actionId, action: JSON.stringify({ actionId: actionId, dependsOn: dependsOn }) }; }

  it('runs parents before children even when creation order is scrambled', function() {
    var ids = orderByDependencies([record('block', ['article']), record('comp', ['block']), record('article', [])]).map(function(r) { return r.actionId; });
    ids.should.eql(['article', 'block', 'comp']);
  });

  it('keeps creation order for independent actions and survives a dependency cycle', function() {
    orderByDependencies([record('x', []), record('y', [])]).map(function(r) { return r.actionId; }).should.eql(['x', 'y']);
    orderByDependencies([record('p', ['q']), record('q', ['p'])]).should.have.length(2);
  });
});

describe('samaritan review fixes: shared settings survive text -> narrative', function() {
  it('carries optional/hidden/layout/classes across instead of resetting them', function() {
    var plan = planTextToNarrative({ _component: 'text', title: 'T', body: 'B', _isOptional: true, _isHidden: true, _layout: 'left', _classes: 'x' });
    plan.targetData.should.containEql({ _isOptional: true, _isHidden: true, _layout: 'left', _classes: 'x' });
    plan.preserved.should.containEql('_isOptional').and.containEql('_isHidden');
  });
});

describe('samaritan review fixes: rewrites see the full text', function() {
  function ctx(longBody) {
    return {
      course: { _id: 'course-1', title: 'C' },
      selection: null,
      blockChildren: [],
      courseSubtree: {
        tree: [{ id: 'p1', title: 'P', articles: [{ id: 'a1', title: 'A', blocks: [{ id: 'b1', title: 'B', components: [{ id: 'c1', type: 'text', title: 'Intro', bodyPreview: 'short preview' }] }] }] }],
        counts: { pages: 1, articles: 1, blocks: 1, components: 1 },
        truncated: false,
        objectivesComponent: null
      },
      availableComponentTypes: [{ _id: 'ct-text', component: 'text', displayName: 'Text' }],
      availableExtensions: [],
      referenceDocuments: [],
      provenance: [],
      loadComponentBodies: function() { return Promise.resolve({ c1: { title: 'Intro', body: longBody } }); }
    };
  }
  var call = function(args) { return { toolCall: { name: 'propose_rewrite_components', arguments: args }, text: null }; };

  it('asks the model again with the full body when the section is longer than its preview', function() {
    var calls = [];
    provider.complete = function(req) {
      calls.push(req);
      return Promise.resolve(call({ rewrites: [{ componentId: 'c1', newContent: calls.length === 1 ? 'from preview' : 'from full text' }], reason: 'x', confidence: 'high' }));
    };
    return reasoner.reason(ctx('<p>' + 'word '.repeat(80) + '</p>'), { message: 'improve intro', requestId: 'r' }).then(function(result) {
      calls.should.have.length(2);
      calls[1].tools.should.have.length(1);
      calls[1].messages[calls[1].messages.length - 1].content.should.containEql('FULL CURRENT TEXT').and.containEql('word word');
      result.plan.actions[0].parameters.content.should.equal('from full text');
    });
  });

  it('does not make a second call when the whole section was already visible', function() {
    var calls = 0;
    provider.complete = function() { calls++; return Promise.resolve(call({ rewrites: [{ componentId: 'c1', newContent: 'new' }], reason: 'x', confidence: 'high' })); };
    return reasoner.reason(ctx('<p>tiny</p>'), { message: 'improve intro', requestId: 'r' }).then(function(result) {
      calls.should.equal(1);
      result.status.should.equal('PLAN_PROPOSED');
    });
  });

  it('declines when the second pass does not return a rewrite', function() {
    var n = 0;
    provider.complete = function() {
      n++;
      return Promise.resolve(n === 1 ? call({ rewrites: [{ componentId: 'c1', newContent: 'x' }], reason: 'x', confidence: 'high' }) : { toolCall: null, text: 'hm' });
    };
    return reasoner.reason(ctx('<p>' + 'word '.repeat(80) + '</p>'), { message: 'improve intro', requestId: 'r' }).then(function(result) {
      result.status.should.equal('DECLINED');
    });
  });

  it('shows the model the selected component body so a rewrite works on the real text', function() {
    var context = {
      course: { _id: 'c', title: 'C' },
      selection: { type: 'component', entity: { _id: 'cmp', _component: 'text', title: 'T', body: '<p>The actual current text</p>' }, blockId: 'b' },
      blockChildren: [], courseSubtree: null, availableComponentTypes: [], availableExtensions: [], referenceDocuments: [], provenance: []
    };
    var text = promptComposer.composeMessages(context, 'translate', []).map(function(m) { return m.content; }).join('\n');
    text.should.containEql('The actual current text');
  });
});
