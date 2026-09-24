var should = require('should');

var executors = require('../plugins/services/samaritan/actions/executors');
var orchestrator = require('../plugins/services/samaritan/actions/orchestrator');

var originalExecuteAction = executors.executeAction;
afterEach(function() { executors.executeAction = originalExecuteAction; });

function fakeApp(destroyCalls) {
  return {
    contentmanager: {
      getContentPlugin: function(type, cb) {
        cb(null, {
          destroy: function(search, force, done) {
            destroyCalls.push({ type: type, id: search._id });
            done(null);
          }
        });
      }
    }
  };
}

function action(actionId, actionType, target, parameters, dependsOn) {
  return { actionId: actionId, actionType: actionType, target: target || {}, parameters: parameters || {}, dependsOn: dependsOn || [] };
}

describe('samaritan orchestrator', function() {
  it('should execute a dependency chain in order, resolving $ref placeholders from prior results', function() {
    var calls = [];
    executors.executeAction = function(app, resolvedAction) {
      calls.push(resolvedAction);
      if (resolvedAction.actionType === 'CREATE_BLOCK') return Promise.resolve({ blockId: 'block-123' });
      if (resolvedAction.actionType === 'ADD_COMPONENT') return Promise.resolve({ componentId: 'comp-456' });
      return Promise.resolve({});
    };

    var actions = [
      action('a1', 'CREATE_BLOCK', { parentId: 'article-1' }),
      action('a2', 'ADD_COMPONENT', { parentId: { $ref: 'a1', path: 'blockId' } }, {}, ['a1'])
    ];

    return orchestrator.executePlan(fakeApp([]), actions, function() {}).then(function(outcome) {
      outcome.status.should.equal('completed');
      calls[1].target.parentId.should.equal('block-123');
    });
  });

  it('should compensate (reverse-order delete) a pure-create plan when a later action fails', function() {
    var destroyCalls = [];
    executors.executeAction = function(app, resolvedAction) {
      if (resolvedAction.actionType === 'CREATE_ARTICLE') return Promise.resolve({ articleId: 'article-1' });
      if (resolvedAction.actionType === 'CREATE_BLOCK') return Promise.reject(new Error('write failed'));
      return Promise.resolve({});
    };

    var actions = [
      action('a1', 'CREATE_ARTICLE', {}, {}),
      action('a2', 'CREATE_BLOCK', {}, {}, ['a1'])
    ];

    return orchestrator.executePlan(fakeApp(destroyCalls), actions, function() {}).then(function(outcome) {
      outcome.status.should.equal('rolled_back');
      outcome.failedActionId.should.equal('a2');
      destroyCalls.should.eql([{ type: 'article', id: 'article-1' }]);
    });
  });

  it('should NOT auto-compensate a plan containing a non-create action (e.g. a plugin toggle) - report partial failure instead', function() {
    var destroyCalls = [];
    executors.executeAction = function(app, resolvedAction) {
      if (resolvedAction.actionType === 'ENABLE_PLUGIN') return Promise.resolve({ enabled: true });
      if (resolvedAction.actionType === 'CREATE_BLOCK') return Promise.reject(new Error('write failed'));
      return Promise.resolve({});
    };

    var actions = [
      action('a1', 'ENABLE_PLUGIN', {}, {}),
      action('a2', 'CREATE_BLOCK', {}, {}, ['a1'])
    ];

    return orchestrator.executePlan(fakeApp(destroyCalls), actions, function() {}).then(function(outcome) {
      outcome.status.should.equal('partial_failure');
      destroyCalls.should.eql([]);
    });
  });

  it('should report partial_failure (not throw) when a $ref cannot be resolved', function() {
    executors.executeAction = function() { return Promise.resolve({}); };
    var actions = [action('a1', 'ADD_COMPONENT', { parentId: { $ref: 'does-not-exist', path: 'blockId' } })];

    return orchestrator.executePlan(fakeApp([]), actions, function() {}).then(function(outcome) {
      outcome.status.should.equal('partial_failure');
      outcome.failedActionId.should.equal('a1');
    });
  });

  it('should pass the RESOLVED action (real ids, not $ref placeholders) to onActionSettled', function() {
    executors.executeAction = function(app, resolvedAction) {
      if (resolvedAction.actionType === 'CREATE_BLOCK') return Promise.resolve({ blockId: 'block-123' });
      return Promise.resolve({ componentId: 'comp-456' });
    };
    var settledTargets = [];
    var actions = [
      action('a1', 'CREATE_BLOCK', { parentId: 'article-1' }),
      action('a2', 'ADD_COMPONENT', { parentId: { $ref: 'a1', path: 'blockId' } }, {}, ['a1'])
    ];

    return orchestrator.executePlan(fakeApp([]), actions, function(a) { settledTargets.push(a.target.parentId); }).then(function() {
      settledTargets[1].should.equal('block-123');
    });
  });

  it('should call onActionSettled for every action with its outcome', function() {
    executors.executeAction = function() { return Promise.resolve({ ok: true }); };
    var settled = [];
    var actions = [action('a1', 'CREATE_ARTICLE', {}, {})];

    return orchestrator.executePlan(fakeApp([]), actions, function(a, status) {
      settled.push({ actionId: a.actionId, status: status });
    }).then(function() {
      settled.should.eql([{ actionId: 'a1', status: 'executed' }]);
    });
  });
});
