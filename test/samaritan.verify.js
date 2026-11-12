var should = require('should');

var actionModel = require('../plugins/services/samaritan/actions/actionModel');
var verify = require('../plugins/services/samaritan/actions/verify');

function buildAction() {
  return actionModel.createAddComponentAction({
    requestId: 'req-1',
    target: { type: 'component', parentId: 'block-1', courseId: 'course-1' },
    parameters: { _component: 'text', _componentType: 'ct-text', title: 'New Text Component' },
    reason: 'test',
    provenance: []
  });
}

describe('samaritan verify.verifyAddComponent', function() {
  it('should pass when the created component matches the action target', function() {
    var action = buildAction();
    var siblings = [
      { _id: 'other-1', _parentId: 'block-1', _courseId: 'course-1', _component: 'graphic', _sortOrder: 1 },
      { _id: 'new-1', _parentId: 'block-1', _courseId: 'course-1', _component: 'text', _sortOrder: 2 }
    ];

    var result = verify.verifyAddComponent(action, 'new-1', siblings);

    result.passed.should.equal(true);
    result.componentId.should.equal('new-1');
    result.checks.every(function(c) { return c.passed; }).should.equal(true);
  });

  it('should fail when the created component is missing from the re-fetched siblings', function() {
    var action = buildAction();
    var result = verify.verifyAddComponent(action, 'missing-id', []);
    result.passed.should.equal(false);
    should(result.componentId).equal(null);
  });

  it('should fail when the component type does not match what was requested', function() {
    var action = buildAction();
    var siblings = [
      { _id: 'new-1', _parentId: 'block-1', _courseId: 'course-1', _component: 'graphic', _sortOrder: 1 }
    ];
    var result = verify.verifyAddComponent(action, 'new-1', siblings);
    result.passed.should.equal(false);
    result.checks.find(function(c) { return c.name === 'component_type_correct'; }).passed.should.equal(false);
  });

  it('should fail when the parent block does not match the action target', function() {
    var action = buildAction();
    var siblings = [
      { _id: 'new-1', _parentId: 'wrong-block', _courseId: 'course-1', _component: 'text', _sortOrder: 1 }
    ];
    var result = verify.verifyAddComponent(action, 'new-1', siblings);
    result.passed.should.equal(false);
  });
});
