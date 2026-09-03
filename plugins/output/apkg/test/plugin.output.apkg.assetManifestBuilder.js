var should = require('should');
var fs = require('fs-extra');
var os = require('os');
var path = require('path');

var buildAssetManifest = require('../lib/assetManifestBuilder');

describe('apkg assetManifestBuilder', function() {
  var tmpBuildFolder;

  beforeEach(function() {
    tmpBuildFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'apkg-assets-'));
  });

  afterEach(function() {
    fs.removeSync(tmpBuildFolder);
  });

  it('should return an empty array when the course has no assets.json', function(done) {
    buildAssetManifest(tmpBuildFolder, 'en', function(error, manifest) {
      should.not.exist(error);
      manifest.should.eql([]);
      done();
    });
  });

  it('should return one entry per referenced asset, with base metadata intact', function(done) {
    var assetsJson = {
      'image.png': { title: 'Image', description: 'An image', tags: [] },
      'video.mp4': { title: 'Video', description: 'A video', tags: [] }
    };
    fs.outputJsonSync(path.join(tmpBuildFolder, 'course', 'en', 'assets.json'), assetsJson);

    buildAssetManifest(tmpBuildFolder, 'en', function(error, manifest) {
      should.not.exist(error);
      manifest.length.should.equal(2);
      var image = manifest.find(function(a) { return a.filename === 'image.png'; });
      should.exist(image);
      image.title.should.equal('Image');
      image.description.should.equal('An image');
      done();
    });
  });
});
