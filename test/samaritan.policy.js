var should = require('should');

var policy = require('../plugins/services/samaritan/actions/policy');

describe('samaritan policy', function() {
  it('should require approval and mark MEDIUM risk for ADD_COMPONENT', function() {
    var p = policy.policyFor('ADD_COMPONENT');
    p.risk.should.equal('MEDIUM');
    p.requiresApproval.should.equal(true);
    p.autoExecutable.should.equal(false);
  });

  it('should require approval and mark MEDIUM risk for CREATE_PAGE', function() {
    var p = policy.policyFor('CREATE_PAGE');
    p.risk.should.equal('MEDIUM');
    p.requiresApproval.should.equal(true);
    p.autoExecutable.should.equal(false);
  });

  it('should default unknown action types to a conservative HIGH-risk, non-auto policy', function() {
    var p = policy.policyFor('SOME_FUTURE_ACTION_TYPE');
    p.risk.should.equal('HIGH');
    p.requiresApproval.should.equal(true);
    p.autoExecutable.should.equal(false);
  });
});
