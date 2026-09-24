var should = require('should');

var actionModel = require('../plugins/services/samaritan/actions/actionModel');

function buildOpts(overrides) {
  return Object.assign(
    {
      requestId: 'req-1',
      target: { type: 'component', parentId: 'block-1', courseId: 'course-1' },
      parameters: { _component: 'text', _componentType: 'ct-text', title: 'New Text Component' },
      reason: 'test',
      provenance: []
    },
    overrides
  );
}

describe('samaritan actionModel', function() {
  it('should build a valid ADD_COMPONENT action with a generated actionId', function() {
    var action = actionModel.createAddComponentAction(buildOpts());
    action.actionId.should.be.a.String();
    action.actionType.should.equal('ADD_COMPONENT');
    action.status.should.equal(actionModel.STATUS.AWAITING_APPROVAL);
    action.risk.should.equal('MEDIUM');
    action.requiresApproval.should.equal(true);
    actionModel.isValidAction(action).should.equal(true);
  });

  it('should generate distinct actionIds for separate actions', function() {
    var a = actionModel.createAddComponentAction(buildOpts());
    var b = actionModel.createAddComponentAction(buildOpts());
    a.actionId.should.not.equal(b.actionId);
  });

  it('should reject a malformed action missing a target', function() {
    actionModel.isValidAction({ actionId: '1', requestId: '1', actionType: 'ADD_COMPONENT' }).should.equal(false);
  });

  it('should reject null/undefined', function() {
    actionModel.isValidAction(null).should.equal(false);
    actionModel.isValidAction(undefined).should.equal(false);
  });
});
