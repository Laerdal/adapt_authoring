var request = require('supertest');
var should = require('should');
var fs = require('fs-extra');
var AdmZip = require('adm-zip');

var origin = require('../../../../');
var database = require('../../../../lib/database');

var testData = require('../../../../test/testData.json');
var ApkgOutput = require('../index');

var app = origin();
var agent = {};
var courseId;

// Exercises the real Adapt Framework build (grunt server-build), so this is
// slow — see Gruntfile.js's default mochaTest timeout (3500ms), overridden
// below via this.timeout().
describe('apkg publish (end-to-end)', function() {
  before(function(done) {
    agent = request.agent(app.getServerURL());
    agent
      .post('/api/login')
      .set('Accept', 'application/json')
      .send({ email: testData.testUser.email, password: testData.testUser.plainPassword })
      .expect(200)
      .end(function(error) {
        if (error) return done(error);
        agent
          .post('/api/content/course')
          .set('Accept', 'application/json')
          .send({ title: 'apkg publish test course', body: '' })
          .expect(200)
          .end(function(error, res) {
            if (error) return done(error);
            courseId = res.body._id;
            done();
          });
      });
  });

  after(function(done) {
    if (!courseId) return done();
    database.getDatabase(function(error, db) {
      if (error) return done(error);
      db.destroy('course', { _id: courseId }, done);
    }, app.configuration.getConfig('dbName'));
  });

  it('should build the course and produce a valid course.apkg', function(done) {
    this.timeout(120000);

    var apkgPlugin = new ApkgOutput();
    apkgPlugin.publish(courseId, 'PUBLISH', null, null, function(error, result) {
      should.not.exist(error);
      result.success.should.be.true;
      fs.existsSync(result.filename).should.be.true;

      var manifest = result.manifest;
      manifest.should.have.properties([
        'courseId', 'title', 'version', 'runtimeVersion',
        'pluginDependencies', 'assetManifest', 'buildTimestamp'
      ]);
      manifest.courseId.should.equal(courseId);

      var zip = new AdmZip(result.filename);
      var entryNames = zip.getEntries().map(function(e) { return e.entryName; });
      entryNames.should.containEql('manifest.json');
      entryNames.should.containEql('index.html');

      var manifestFromZip = JSON.parse(zip.readAsText('manifest.json'));
      manifestFromZip.should.eql(manifest);

      done();
    });
  });
});
