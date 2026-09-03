var should = require('should');
var generateManifest = require('../lib/manifestGenerator');

var VALID_PARAMS = {
  courseId: '5f1a1a1a1a1a1a1a1a1a1a1a',
  title: 'Test Course',
  version: '1.0.0',
  runtimeVersion: '5.55.2',
  pluginDependencies: [{ name: 'adapt-contrib-vanilla', type: 'theme', version: '5.0.0', displayName: 'Vanilla' }],
  assetManifest: [{ filename: 'image.png', title: 'Image' }]
};

describe('apkg manifestGenerator', function() {
  it('should produce exactly the required manifest fields', function(done) {
    generateManifest(VALID_PARAMS, function(error, manifest) {
      should.not.exist(error);
      manifest.should.have.properties([
        'courseId', 'title', 'version', 'runtimeVersion',
        'pluginDependencies', 'assetManifest', 'buildTimestamp'
      ]);
      Object.keys(manifest).length.should.equal(7);
      done();
    });
  });

  it('should stamp a valid ISO buildTimestamp', function(done) {
    generateManifest(VALID_PARAMS, function(error, manifest) {
      should.not.exist(error);
      new Date(manifest.buildTimestamp).toISOString().should.equal(manifest.buildTimestamp);
      done();
    });
  });

  it('should default pluginDependencies/assetManifest to empty arrays when omitted', function(done) {
    var params = Object.assign({}, VALID_PARAMS);
    delete params.pluginDependencies;
    delete params.assetManifest;
    generateManifest(params, function(error, manifest) {
      should.not.exist(error);
      manifest.pluginDependencies.should.eql([]);
      manifest.assetManifest.should.eql([]);
      done();
    });
  });

  it('should error when a required field is missing', function(done) {
    var params = Object.assign({}, VALID_PARAMS);
    delete params.runtimeVersion;
    generateManifest(params, function(error, manifest) {
      should.exist(error);
      error.message.should.containEql('runtimeVersion');
      done();
    });
  });
});
