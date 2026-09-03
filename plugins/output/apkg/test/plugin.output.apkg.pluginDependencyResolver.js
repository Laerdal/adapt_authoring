var request = require('supertest');
var should = require('should');

var origin = require('../../../../');
var database = require('../../../../lib/database');

var testData = require('../../../../test/testData.json');
var buildPluginDependencies = require('../lib/pluginDependencyResolver');

var app = origin();
var agent = {};
var courseId;

describe('apkg pluginDependencyResolver', function() {
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
          .send({ title: 'apkg pluginDependencyResolver test course', body: '' })
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

  it('should resolve the course default theme and menu as plugin dependencies', function(done) {
    app.outputmanager.getOutputPlugin('adapt', function(error, adaptPlugin) {
      should.not.exist(error);
      buildPluginDependencies(adaptPlugin, courseId, function(error, dependencies) {
        should.not.exist(error);
        dependencies.should.be.an.Array;

        var theme = dependencies.find(function(d) { return d.type === 'theme'; });
        var menu = dependencies.find(function(d) { return d.type === 'menu'; });
        should.exist(theme, 'expected a theme dependency for the course default theme');
        should.exist(menu, 'expected a menu dependency for the course default menu');
        // version is DB-record-dependent (null is a valid, documented outcome
        // when the *type collection has no matching record), so only the
        // presence/shape of the entry is asserted here.
        theme.should.have.properties(['name', 'type', 'version', 'displayName']);
        menu.should.have.properties(['name', 'type', 'version', 'displayName']);
        done();
      });
    });
  });
});
