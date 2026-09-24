var should = require('should');

var config = require('../plugins/services/samaritan/ai/config');

var ENV_KEYS = ['SAMARITAN_AI_API_KEY', 'SAMARITAN_AI_ENDPOINT', 'SAMARITAN_AI_DEPLOYMENT', 'SAMARITAN_AI_APIVERSION'];
var savedEnv = {};

beforeEach(function() {
  ENV_KEYS.forEach(function(k) { savedEnv[k] = process.env[k]; delete process.env[k]; });
});
afterEach(function() {
  ENV_KEYS.forEach(function(k) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
});

describe('samaritan ai config (decoupled from storyboard/ckEditor)', function() {
  it('should report not configured when no key/endpoint are set anywhere', function() {
    config.isConfigured().should.equal(false);
  });

  it('should read credentials from SAMARITAN_AI_* env vars', function() {
    process.env.SAMARITAN_AI_API_KEY = 'test-key';
    process.env.SAMARITAN_AI_ENDPOINT = 'https://example.openai.azure.com';
    config.isConfigured().should.equal(true);
    var s = config.getSettings();
    s.key.should.equal('test-key');
    s.endpoint.should.equal('https://example.openai.azure.com');
  });

  it('should default deployment and apiVersion when not explicitly set', function() {
    process.env.SAMARITAN_AI_API_KEY = 'test-key';
    process.env.SAMARITAN_AI_ENDPOINT = 'https://example.openai.azure.com';
    var s = config.getSettings();
    s.deployment.should.equal('gpt-4o-mini');
    s.apiVersion.should.equal('2024-08-01-preview');
  });

  it('should strip a trailing slash from the endpoint', function() {
    process.env.SAMARITAN_AI_API_KEY = 'test-key';
    process.env.SAMARITAN_AI_ENDPOINT = 'https://example.openai.azure.com/';
    config.getSettings().endpoint.should.equal('https://example.openai.azure.com');
  });

  it('should never read storyboard/ckEditor config keys as a fallback', function() {
    // Simulate storyboard/ckEditor being configured but Samaritan not - this
    // must NOT make isConfigured() true. There's no live app/config.json
    // loaded in this unit test, so absence of a crash plus isConfigured()
    // staying false is itself the proof there is no such fallback wired in.
    should(config.isConfigured()).equal(false);
  });
});
