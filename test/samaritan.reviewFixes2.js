var should = require('should');

var claim = require('../plugins/services/samaritan/actions/claim');
var { findObjectivesComponent } = require('../plugins/services/samaritan/context/objectives');
var executors = require('../plugins/services/samaritan/actions/executors');
var orchestrator = require('../plugins/services/samaritan/actions/orchestrator');
var provider = require('../plugins/services/samaritan/ai/azureProvider');
var reasoner = require('../plugins/services/samaritan/reasoning/reasoner');

var originalExecute = executors.executeAction;
var originalComplete = provider.complete;
afterEach(function() {
  executors.executeAction = originalExecute;
  provider.complete = originalComplete;
});

describe('samaritan atomic approval claim', function() {
  function fakeDb(result, seen) {
    return {
      getModel: function() {
        return { findOneAndUpdate: function(conditions, update, options, cb) { seen.push({ conditions: conditions, update: update }); cb(null, result); } };
      }
    };
  }

  it('claims only a record that is still awaiting approval, and reports who won', function() {
    var seen = [];
    return claim.claimAwaiting(fakeDb({ _id: 'r1' }, seen), { _id: 'r1' }).then(function(won) {
      won.should.equal(true);
      seen[0].conditions.should.eql({ _id: 'r1', status: 'awaiting_approval' });
      seen[0].update.should.eql({ $set: { status: 'executing' } });
      return claim.claimAwaiting(fakeDb(null, []), { _id: 'r1' });
    }).then(function(won) { won.should.equal(false); });
  });

  it('hands a claim back only if it is still executing', function() {
    var seen = [];
    return claim.releaseClaim(fakeDb({ _id: 'r1' }, seen), { _id: 'r1' }).then(function() {
      seen[0].conditions.should.eql({ _id: 'r1', status: 'executing' });
      seen[0].update.should.eql({ $set: { status: 'awaiting_approval' } });
    });
  });

  it('picks the same record to claim no matter the order records arrive in', function() {
    var a = [{ actionId: 'b' }, { actionId: 'a' }, { actionId: 'c' }];
    claim.claimRecordFor(a).actionId.should.equal('a');
    claim.claimRecordFor(a.slice().reverse()).actionId.should.equal('a');
  });

  it('fails loudly when the model cannot be reached, instead of approving without a claim', function() {
    return claim.claimAwaiting({ getModel: function() { return false; } }, { _id: 'r1' }).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('WRITE_FAILED'); }
    );
  });
});

describe('samaritan objectives matching', function() {
  function text(id, title, body) { return { _id: id, _component: 'text', title: title, body: body || '', _parentId: 'b-' + id }; }

  it('does not treat an unrelated section as the objectives', function() {
    should.equal(findObjectivesComponent([text('1', 'Objective assessment of breathing', '<p>Check the chest rise.</p>')]).component, null);
  });

  it('prefers a titled objectives section over one that only starts like objectives', function() {
    var found = findObjectivesComponent([text('1', 'Welcome', '<p>Learning objectives: be calm</p>'), text('2', 'Learning objectives', '<p>x</p>')]);
    found.component.componentId.should.equal('2');
    found.ambiguous.should.equal(false);
  });

  it('recognises objectives that are only introduced in the body', function() {
    findObjectivesComponent([text('1', 'Intro', '<h3>Learning objectives</h3><ul><li>a</li></ul>')]).component.componentId.should.equal('1');
    findObjectivesComponent([text('1', 'Intro', '<p>By the end of this course you will be able to:</p>')]).component.componentId.should.equal('1');
  });

  it('reports several candidates as ambiguous instead of choosing one', function() {
    var found = findObjectivesComponent([text('1', 'Objectives', ''), text('2', 'Learning objectives', '')]);
    found.ambiguous.should.equal(true);
  });

  it('ignores components that are not Text', function() {
    should.equal(findObjectivesComponent([{ _id: '1', _component: 'mcq', title: 'Objectives', _parentId: 'b' }]).component, null);
  });
});

describe('samaritan compensation reporting', function() {
  var plan = [
    { actionId: 'a', actionType: 'CREATE_ARTICLE', target: {}, parameters: {} },
    { actionId: 'b', actionType: 'CREATE_BLOCK', target: {}, parameters: {} },
    { actionId: 'c', actionType: 'ADD_COMPONENT', target: {}, parameters: {} }
  ];
  function app(destroyFailsFor) {
    return {
      usermanager: { getCurrentUser: function() { return { _id: 'u' }; } },
      contentmanager: {
        getContentPlugin: function(type, cb) {
          cb(null, { destroy: function(search, force, done) { done(destroyFailsFor === type ? new Error('delete failed') : null); } });
        }
      }
    };
  }
  function failOnThird() {
    executors.executeAction = function(a, action) {
      if (action.actionId === 'c') return Promise.reject(new Error('boom'));
      return Promise.resolve(action.actionId === 'a' ? { articleId: 'article-1' } : { blockId: 'block-1' });
    };
  }

  it('lists every action it reversed after a clean rollback', function() {
    failOnThird();
    return orchestrator.executePlan(app(null), plan, function() {}).then(function(outcome) {
      outcome.status.should.equal('rolled_back');
      outcome.compensatedActionIds.should.eql(['b', 'a']);
    });
  });

  it('still lists what it reversed when a later delete fails, so those records are not left as executed', function() {
    failOnThird();
    return orchestrator.executePlan(app('article'), plan, function() {}).then(function(outcome) {
      outcome.status.should.equal('partial_failure');
      outcome.compensatedActionIds.should.eql(['b']);
    });
  });
});

describe('samaritan rewrite and objectives safety', function() {
  var TYPES = [{ _id: 'ct-text', component: 'text', displayName: 'Text' }];
  function ctx(overrides) {
    return Object.assign({
      course: { _id: 'course-1', title: 'C' },
      selection: null,
      blockChildren: [],
      courseSubtree: {
        tree: [{ id: 'p1', title: 'P', articles: [{ id: 'a1', title: 'A', blocks: [{ id: 'b1', title: 'B', components: [] }] }] }],
        counts: { pages: 1, articles: 1, blocks: 1, components: 0 },
        truncated: false,
        objectivesComponent: null,
        objectivesAmbiguous: false
      },
      availableComponentTypes: TYPES, availableExtensions: [], referenceDocuments: [], provenance: []
    }, overrides);
  }
  var call = function(name, args) { return { toolCall: { name: name, arguments: args }, text: null }; };

  it('declines to rewrite a selected component whose body is longer than the model was shown', function() {
    var context = ctx({
      selection: { type: 'component', entity: { _id: 'c1', _component: 'text', title: 'T', body: 'x'.repeat(6001) }, blockId: 'b1' },
      courseSubtree: null
    });
    provider.complete = function() { return Promise.resolve(call('propose_rewrite_content', { newContent: 'short', reason: 'x', confidence: 'high' })); };
    return reasoner.reason(context, { message: 'proofread', requestId: 'r' }).then(function(result) {
      result.status.should.equal('DECLINED');
      result.declined.category.should.equal('unsupported_action');
    });
  });

  it('still rewrites a selected component that fits what the model was shown', function() {
    var context = ctx({
      selection: { type: 'component', entity: { _id: 'c1', _component: 'text', title: 'T', body: '<p>short</p>' }, blockId: 'b1' },
      courseSubtree: null
    });
    provider.complete = function() { return Promise.resolve(call('propose_rewrite_content', { newContent: 'better', reason: 'x', confidence: 'high' })); };
    return reasoner.reason(context, { message: 'proofread', requestId: 'r' }).then(function(result) {
      result.status.should.equal('PROPOSED');
    });
  });

  it('refuses to guess which section to update when several look like objectives', function() {
    var context = ctx();
    context.courseSubtree.objectivesAmbiguous = true;
    provider.complete = function() { return Promise.resolve(call('propose_update_objectives', { objectives: ['Explain CPR'], reason: 'x', confidence: 'high' })); };
    return reasoner.reason(context, { message: 'improve objectives', requestId: 'r' }).then(function(result) {
      result.status.should.equal('DECLINED');
      result.declined.category.should.equal('invalid_target');
    });
  });

  it('shows the model the full existing objectives before it replaces them', function() {
    var context = ctx();
    context.courseSubtree.objectivesComponent = { componentId: 'obj-1', title: 'Learning objectives', blockId: 'b1' };
    context.loadComponentBodies = function() { return Promise.resolve({ 'obj-1': { title: 'Learning objectives', body: '<ul>' + '<li>an existing objective</li>'.repeat(20) + '</ul>' } }); };
    var calls = [];
    provider.complete = function(req) {
      calls.push(req);
      return Promise.resolve(call('propose_update_objectives', { objectives: [calls.length === 1 ? 'first pass' : 'second pass'], reason: 'x', confidence: 'high' }));
    };
    return reasoner.reason(context, { message: 'improve objectives', requestId: 'r' }).then(function(result) {
      calls.should.have.length(2);
      calls[1].tools.should.have.length(1);
      calls[1].messages[calls[1].messages.length - 1].content.should.containEql('an existing objective');
      result.plan.actions[0].parameters.content.should.containEql('second pass');
    });
  });
});
