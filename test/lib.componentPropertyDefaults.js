var should = require('should');

var componentPropertyDefaults = require('../lib/componentPropertyDefaults');

describe('componentPropertyDefaults', function() {
  it('should merge shared and component defaults into new component data', function() {
    var data = {
      _component: 'mcq',
      properties: {
        _attempts: 1
      }
    };
    var config = {
      '*': {
        title: 'Shared title',
        body: 'Shared body',
        'properties._attempts': 2,
        'properties._canShowFeedback': true
      },
      mcq: {
        title: 'MCQ title',
        'properties._attempts': 3
      }
    };

    componentPropertyDefaults.applyDefaultsToObject(data, data._component, config);

    data.title.should.equal('MCQ title');
    data.body.should.equal('Shared body');
    data.properties._attempts.should.equal(1);
    data.properties._canShowFeedback.should.equal(true);
  });

  it('should apply shared and component defaults to component schemas', function() {
    var schema = {
      title: { type: 'string' },
      body: { type: 'string' },
      properties: {
        type: 'object',
        properties: {
          _attempts: { type: 'number', default: 1 },
          _canShowFeedback: { type: 'boolean' }
        }
      }
    };
    var config = {
      '*': {
        title: 'Shared title',
        'properties._attempts': 2,
        'properties._canShowFeedback': true
      },
      mcq: {
        body: 'MCQ body',
        'properties._attempts': 4
      }
    };

    componentPropertyDefaults.applyDefaultsToSchema(schema, 'mcq', config);

    schema.title.default.should.equal('Shared title');
    schema.body.default.should.equal('MCQ body');
    schema.properties.properties._attempts.default.should.equal(4);
    schema.properties.properties._canShowFeedback.default.should.equal(true);
  });
});