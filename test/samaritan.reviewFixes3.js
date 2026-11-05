var should = require('should');

var executors = require('../plugins/services/samaritan/actions/executors');
var orchestrator = require('../plugins/services/samaritan/actions/orchestrator');
var { planTextToNarrative } = require('../plugins/services/samaritan/actions/migrations/textToNarrative');
var { parseApproved } = require('../plugins/services/samaritan/utils/request');
var provider = require('../plugins/services/samaritan/ai/azureProvider');
var reasoner = require('../plugins/services/samaritan/reasoning/reasoner');
var database = require('../lib/database');
var resolver = require('../plugins/services/samaritan/context/resolver');

var originalExecute = executors.executeAction;
var originalComplete = provider.complete;
var originalGetDatabase = database.getDatabase;
afterEach(function() {
  executors.executeAction = originalExecute;
  provider.complete = originalComplete;
  database.getDatabase = originalGetDatabase;
});

function fakeApp(plugins, extra) {
  return Object.assign({
    usermanager: { getCurrentUser: function() { return { _id: 'user-1' }; } },
    contentmanager: {
      getContentPlugin: function(type, cb) {
        if (!plugins[type]) return cb(new Error('no plugin ' + type));
        cb(null, plugins[type]);
      }
    }
  }, extra || {});
}

describe('samaritan review round 3: writes stay in the approved course', function() {
  function componentPlugin(doc, updates) {
    return {
      retrieve: function(search, opts, cb) { cb(null, doc ? [doc] : []); },
      update: function(search, delta, cb) { updates.push({ search: search, delta: delta }); cb(null); },
      destroy: function(search, force, cb) { updates.push({ destroyed: search }); cb(null); }
    };
  }
  var rewrite = { actionType: 'REWRITE_CONTENT', target: { type: 'component', id: 'c1', courseId: 'course-1' }, parameters: { content: 'new' } };

  it('refuses to rewrite a component that has moved to another course', function() {
    var updates = [];
    var app = fakeApp({ component: componentPlugin({ _id: 'c1', _courseId: 'other-course' }, updates) });
    return executors.executeAction(app, rewrite).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('COURSE_MISMATCH'); updates.should.have.length(0); }
    );
  });

  it('refuses to rewrite a component that no longer exists', function() {
    var updates = [];
    return executors.executeAction(fakeApp({ component: componentPlugin(null, updates) }), rewrite).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('NOT_FOUND'); updates.should.have.length(0); }
    );
  });

  it('scopes the update itself to the course as well', function() {
    var updates = [];
    var app = fakeApp({ component: componentPlugin({ _id: 'c1', _courseId: 'course-1' }, updates) });
    return executors.executeAction(app, rewrite).then(function() {
      updates[0].search.should.eql({ _id: 'c1', _courseId: 'course-1' });
    });
  });

  it('does not remove a component from another course', function() {
    var updates = [];
    var app = fakeApp({ component: componentPlugin({ _id: 'c1', _courseId: 'other-course' }, updates) });
    return executors.executeAction(app, { actionType: 'REMOVE_COMPONENT', target: { id: 'c1', courseId: 'course-1' }, parameters: {} }).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('COURSE_MISMATCH'); updates.should.have.length(0); }
    );
  });

  it('keeps _isVisible when a text component becomes a narrative', function() {
    var plan = planTextToNarrative({ _component: 'text', title: 'T', body: 'B', _isVisible: false });
    plan.targetData._isVisible.should.equal(false);
    plan.preserved.should.containEql('_isVisible');
  });
});

describe('samaritan review round 3: plugin toggles use the host events', function() {
  it('enables extensions through extensions:enable', function() {
    var seen = [];
    var app = fakeApp({}, { emit: function(event, courseId, ids, cb) { seen.push([event, courseId, ids]); cb(null); } });
    return executors.executeAction(app, { actionType: 'ENABLE_PLUGIN', target: { courseId: 'course-1' }, parameters: { extensionIds: ['e1'] } }).then(function(result) {
      seen.should.eql([['extensions:enable', 'course-1', ['e1']]]);
      result.enabled.should.equal(true);
    });
  });

  it('disables through extensions:disable and surfaces a host error', function() {
    var app = fakeApp({}, { emit: function(event, courseId, ids, cb) { event.should.equal('extensions:disable'); cb(new Error('host said no')); } });
    return executors.executeAction(app, { actionType: 'DISABLE_PLUGIN', target: { courseId: 'course-1' }, parameters: { extensionIds: ['e1'] } }).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.message.should.containEql('host said no'); }
    );
  });
});

describe('samaritan review round 3: audit failures cannot block compensation', function() {
  var plan = [
    { actionId: 'a', actionType: 'CREATE_ARTICLE', target: {}, parameters: {} },
    { actionId: 'b', actionType: 'CREATE_BLOCK', target: {}, parameters: {} },
    { actionId: 'c', actionType: 'ADD_COMPONENT', target: {}, parameters: {} }
  ];
  var destroyed;
  function app() {
    destroyed = [];
    return fakeApp({}, {
      contentmanager: { getContentPlugin: function(type, cb) { cb(null, { destroy: function(search, force, done) { destroyed.push(type); done(null); } }); } }
    });
  }

  it('still rolls back, and reports the audit failure, when persisting the audit record throws', function() {
    executors.executeAction = function(a, action) {
      if (action.actionId === 'c') return Promise.reject(new Error('boom'));
      return Promise.resolve(action.actionId === 'a' ? { articleId: 'article-1' } : { blockId: 'block-1' });
    };
    var settle = function() { return Promise.reject(new Error('audit write failed')); };
    return orchestrator.executePlan(app(), plan, settle).then(function(outcome) {
      outcome.status.should.equal('rolled_back');
      destroyed.should.eql(['block', 'article']);
      outcome.auditErrors.length.should.be.above(0);
      outcome.auditErrors[0].message.should.equal('audit write failed');
    });
  });

  it('returns what it applied when every audit write fails on a plan that otherwise succeeds', function() {
    executors.executeAction = function() { return Promise.resolve({ articleId: 'article-1' }); };
    return orchestrator.executePlan(app(), plan.slice(0, 1), function() { return Promise.reject(new Error('audit down')); }).then(function(outcome) {
      outcome.status.should.equal('completed');
      outcome.executedActionIds.should.eql(['a']);
      outcome.auditErrors.should.have.length(1);
    });
  });
});

describe('samaritan review round 3: approval body must be a boolean', function() {
  it('accepts only a literal true or false', function() {
    parseApproved({ approved: true }).should.equal(true);
    parseApproved({ approved: false }).should.equal(false);
  });

  it('rejects strings, numbers and a missing value instead of treating them as true', function() {
    ['false', 'true', 1, 0, null, undefined].forEach(function(v) {
      (function() { parseApproved({ approved: v }); }).should.throw(/approved must be true or false/);
    });
    (function() { parseApproved(undefined); }).should.throw();
  });
});

describe('samaritan review round 3: reasoner guards', function() {
  var TYPES = [{ _id: 'ct-text', component: 'text', displayName: 'Text' }, { _id: 'ct-mcq', component: 'mcq', displayName: 'MCQ' }];
  function ctx(overrides) {
    return Object.assign({
      course: { _id: 'course-1', title: 'C' },
      selection: null, blockChildren: [],
      courseSubtree: {
        tree: [{ id: 'p1', title: 'P', articles: [{ id: 'a1', title: 'A', blocks: [{ id: 'b1', title: 'B', components: [
          { id: 'c1', type: 'text', title: 'One', bodyPreview: 'x' }, { id: 'c2', type: 'text', title: 'Two', bodyPreview: 'y' }
        ] }] }] }],
        counts: { pages: 1, articles: 1, blocks: 1, components: 2 }, truncated: false, objectivesComponent: null, objectivesAmbiguous: false
      },
      availableComponentTypes: TYPES, availableExtensions: [], referenceDocuments: [], provenance: [],
      loadComponentBodies: function(ids) {
        var out = {};
        ids.forEach(function(id) { out[id] = { title: id, body: id === 'c1' ? '<p>See <a href="https://x.example/doc">the guide</a></p>' : '<p>short</p>' }; });
        return Promise.resolve(out);
      }
    }, overrides);
  }
  var call = function(name, args) { return { toolCall: { name: name, arguments: args }, text: null }; };

  it('grounds a short body that hides a link from the plain-text preview', function() {
    var calls = 0;
    provider.complete = function() { calls++; return Promise.resolve(call('propose_rewrite_components', { rewrites: [{ componentId: 'c1', newContent: calls === 1 ? 'first' : 'second' }], reason: 'x', confidence: 'high' })); };
    return reasoner.reason(ctx(), { message: 'reword', requestId: 'r' }).then(function(result) {
      calls.should.equal(2);
      result.plan.actions[0].parameters.content.should.equal('second');
    });
  });

  it('rejects a second pass that rewrites a component whose full text it was not shown', function() {
    var calls = 0;
    provider.complete = function() {
      calls++;
      return Promise.resolve(call('propose_rewrite_components', { rewrites: [{ componentId: calls === 1 ? 'c1' : 'c2', newContent: 'x' }], reason: 'x', confidence: 'high' }));
    };
    return reasoner.reason(ctx(), { message: 'reword', requestId: 'r' }).then(function(result) {
      calls.should.equal(2);
      result.status.should.equal('DECLINED');
    });
  });

  it('declines a tool that was withheld for this context even though a handler exists', function() {
    provider.complete = function() { return Promise.resolve(call('propose_course_outline', { title: 'New', objectives: [], assumptions: [], articles: [{ title: 'A', content: 'c' }], reason: 'x', confidence: 'high' })); };
    return reasoner.reason(ctx(), { message: 'make a course', requestId: 'r' }).then(function(result) {
      result.status.should.equal('DECLINED');
    });
  });

  it('makes the assessment page wait for the course it is created in', function() {
    var empty = ctx({ courseSubtree: { tree: [], counts: { pages: 0, articles: 0, blocks: 0, components: 0 }, truncated: false, objectivesComponent: null } });
    provider.complete = function() {
      return Promise.resolve(call('propose_course_outline', {
        title: 'CPR', objectives: ['a'], assumptions: [], articles: [{ title: 'A', content: 'c' }],
        assessmentQuestions: [{ question: 'Q?', options: [{ text: 'a', correct: true }, { text: 'b', correct: false }] }],
        reason: 'x', confidence: 'high'
      }));
    };
    return reasoner.reason(empty, { message: 'build a course', requestId: 'r' }).then(function(result) {
      var course = result.plan.actions.find(function(a) { return a.actionType === 'CREATE_COURSE'; });
      var page = result.plan.actions.filter(function(a) { return a.actionType === 'CREATE_PAGE'; })[0];
      page.dependsOn.should.containEql(course.actionId);
    });
  });
});

describe('samaritan review round 3: learner order', function() {
  function matches(doc, search) { return Object.keys(search || {}).every(function(k) { return String(doc[k]) === String(search[k]); }); }

  it('lists pages (and so the "first page") in _sortOrder, not database order', function() {
    var content = {
      course: [{ _id: 'course-1', title: 'C' }],
      contentobject: [
        { _id: 'second', _type: 'page', _parentId: 'course-1', _courseId: 'course-1', title: 'Second', _sortOrder: 2 },
        { _id: 'first', _type: 'page', _parentId: 'course-1', _courseId: 'course-1', title: 'First', _sortOrder: 1 }
      ],
      article: [], block: [], component: [], storyboard: []
    };
    var plugins = {};
    Object.keys(content).forEach(function(t) { plugins[t] = { retrieve: function(s, o, cb) { cb(null, content[t].filter(function(d) { return matches(d, s); })); } }; });
    database.getDatabase = function(cb) { cb(null, { retrieve: function(c, s, done) { done(null, []); } }); };
    var app = { contentmanager: { getContentPlugin: function(t, cb) { plugins[t] ? cb(null, plugins[t]) : cb(new Error('no ' + t)); } } };
    return resolver.resolveContextAsync(app, { courseId: 'course-1' }).then(function(context) {
      context.courseSubtree.tree.map(function(p) { return p.id; }).should.eql(['first', 'second']);
    });
  });
});
