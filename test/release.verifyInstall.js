// Unit tests for scripts/release/verify-install.js (post-deploy plugin check). Pure logic plus a temp folder:
// no MongoDB, no instance needed (the DB/disk probes are injected).

var should = require('should');
var fs = require('fs');
var os = require('os');
var path = require('path');
var verify = require('../scripts/release/verify-install');

function plugin(type, folder, name, version) { return { type: type, folder: folder, name: name, version: version }; }

// probes describing a healthy instance for the given plugins; override single probes to break it
function healthy(expected, overrides) {
  return Object.assign({
    srcVersion: function (p) { return p.version; },
    hasVersionCopy: function () { return true; },
    dbRows: function (p) { return [{ name: p.name, version: p.version }]; }
  }, overrides);
}

describe('release verify-install', function () {
  var tmp;
  var life = plugin('theme', 'theme', 'adapt-laerdal-life', '6.2.6');

  beforeEach(function () { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-install-')); });
  afterEach(function () { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('reads name and version of every plugin folder, per type', function () {
    fs.mkdirSync(path.join(tmp, 'theme', 'life'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'theme', 'life', 'bower.json'), JSON.stringify({ name: 'adapt-laerdal-life', version: '6.2.6' }));
    fs.mkdirSync(path.join(tmp, 'components', 'text'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'components', 'text', 'bower.json'), JSON.stringify({ name: 'adapt-laerdal-text', version: '5.4.3' }));
    var result = verify.readExpected(tmp);
    result.problems.should.eql([]);
    result.expected.should.containEql(life);
    result.expected.should.containEql(plugin('component', 'components', 'adapt-laerdal-text', '5.4.3'));
  });

  it('reports a plugin folder whose bower.json is missing (e.g. an unfetched submodule)', function () {
    fs.mkdirSync(path.join(tmp, 'theme', 'adapt-laerdal-life-v2'), { recursive: true });
    var result = verify.readExpected(tmp);
    result.expected.should.eql([]);
    result.problems.should.have.length(1);
    result.problems[0].should.containEql('adapt-laerdal-life-v2');
  });

  it('is quiet when folder, versions copy and DB row all match', function () {
    verify.findProblems([life], healthy([life])).should.eql([]);
  });

  it('flags the SD failure: DB row present but theme folder and versions copy gone', function () {
    var problems = verify.findProblems([life], healthy([life], {
      srcVersion: function () { return null; },
      hasVersionCopy: function () { return false; }
    }));
    problems.should.have.length(2);
    problems[0].should.containEql('folder missing');
    problems[1].should.containEql('versions');
  });

  it('flags a missing DB row, duplicate rows and version drift', function () {
    verify.findProblems([life], healthy([life], { dbRows: function () { return []; } }))[0].should.containEql('no database row');
    verify.findProblems([life], healthy([life], { dbRows: function (p) { return [{ name: p.name, version: '6.2.5' }, { name: p.name, version: '6.2.6' }]; } }))[0].should.containEql('2 database rows');
    verify.findProblems([life], healthy([life], { dbRows: function (p) { return [{ name: p.name, version: '6.2.5' }]; } }))[0].should.containEql('database has 6.2.5');
    verify.findProblems([life], healthy([life], { srcVersion: function () { return '6.2.5'; } }))[0].should.containEql('has 6.2.5');
  });
});
