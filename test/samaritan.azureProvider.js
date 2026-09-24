var should = require('should');

var ENV_KEYS = ['SAMARITAN_AI_API_KEY', 'SAMARITAN_AI_ENDPOINT'];
var savedEnv = {};

beforeEach(function() {
  ENV_KEYS.forEach(function(k) { savedEnv[k] = process.env[k]; delete process.env[k]; });
  // config.js and azureProvider.js are required fresh per test so the
  // env-var changes above actually take effect (config.js reads env at
  // call time, not at require time, so this isn't strictly required for
  // correctness here, but keeps this test isolated from others' env state).
  delete require.cache[require.resolve('../plugins/services/samaritan/ai/azureProvider')];
  delete require.cache[require.resolve('../plugins/services/samaritan/ai/config')];
});
afterEach(function() {
  ENV_KEYS.forEach(function(k) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
});

describe('samaritan azure provider (real complete() implementation, not mocked)', function() {
  it('should throw AI_NOT_CONFIGURED without making a network call when unconfigured', function() {
    var provider = require('../plugins/services/samaritan/ai/azureProvider');
    return provider.complete({ messages: [], tools: [] }).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('AI_NOT_CONFIGURED'); }
    );
  });
});
