var should = require('should');
var fs = require('fs-extra');
var os = require('os');
var path = require('path');
var AdmZip = require('adm-zip');

var packageApkg = require('../lib/packager');

describe('apkg packager', function() {
  var tmpBuildFolder;
  var destFile;

  beforeEach(function() {
    tmpBuildFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'apkg-build-'));
    fs.outputFileSync(path.join(tmpBuildFolder, 'index.html'), '<html></html>');
    fs.outputFileSync(path.join(tmpBuildFolder, 'course', 'course.json'), '{"title":"Test"}');
    destFile = path.join(os.tmpdir(), 'apkg-test-' + Date.now() + '.apkg');
  });

  afterEach(function() {
    fs.removeSync(tmpBuildFolder);
    fs.removeSync(destFile);
  });

  it('should produce a zip containing manifest.json and the build folder contents', function(done) {
    var manifest = { courseId: 'abc', title: 'Test', version: '1.0.0', runtimeVersion: '5.55.2', pluginDependencies: [], assetManifest: [], buildTimestamp: new Date().toISOString() };

    packageApkg(tmpBuildFolder, destFile, manifest, function(error, result) {
      should.not.exist(error);
      result.filename.should.equal(destFile);
      result.size.should.be.above(0);

      var zip = new AdmZip(destFile);
      var entryNames = zip.getEntries().map(function(e) { return e.entryName; });
      entryNames.should.containEql('manifest.json');
      entryNames.should.containEql('index.html');
      entryNames.should.containEql(path.join('course', 'course.json').replace(/\\/g, '/'));

      var manifestEntry = JSON.parse(zip.readAsText('manifest.json'));
      manifestEntry.should.eql(manifest);
      done();
    });
  });
});
