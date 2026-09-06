// Unit tests for the comment-driven status workflow (ADAPT-3760): Draft (no
// comments) -> In Review (unresolved top-level comment) -> Approved (all
// resolved) -> back to Draft if every comment is removed. Pure logic test —
// mocks the `db` wrapper with an in-memory store rather than a live MongoDB
// (none is available in this environment; requestHandlers.js itself requires
// cleanly without one since the app singleton connects lazily).

var should = require('should');
var db = require('../plugins/content/storyboard/utils/database');
var handlers = require('../plugins/content/storyboard/routes/requestHandlers');

var store;
var idCounter;

function resetStore() {
  store = { storyboard: [], storyboardcomment: [], storyboardaudit: [] };
  idCounter = 0;
  store.storyboard.push({ _id: 'sb-1', _courseId: 'course-1', status: 'draft', title: 'Untitled Storyboard' });
}

function matches(doc, search) {
  return Object.keys(search).every(function (k) { return String(doc[k]) === String(search[k]); });
}

db.create = function (type, data) {
  idCounter += 1;
  var doc = Object.assign({ _id: 'gen-' + idCounter, createdAt: new Date() }, data);
  store[type].push(doc);
  return Promise.resolve(doc);
};
db.retrieve = function (type, search) {
  return Promise.resolve(store[type].filter(function (doc) { return matches(doc, search || {}); }));
};
db.update = function (type, search, delta) {
  var matched = store[type].filter(function (doc) { return matches(doc, search || {}); });
  matched.forEach(function (doc) { Object.assign(doc, delta); });
  return Promise.resolve(matched[0]);
};
db.destroy = function (type, search) {
  store[type] = store[type].filter(function (doc) { return !matches(doc, search || {}); });
  return Promise.resolve();
};

function fakeRes() {
  var res = {};
  res.statusCode = 200;
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (body) { res.body = body; return res; };
  return res;
}

var REQ_USER = { user: { _id: 'user-1', tenant: { _id: 'tenant-1' } } };

function currentStatus() {
  return store.storyboard[0].status;
}

describe('comment-driven storyboard status', function () {
  beforeEach(resetStore);

  it('stays Draft when there are no comments', function () {
    currentStatus().should.equal('draft');
  });

  it('moves to In Review when an unresolved comment is added', function (done) {
    var req = Object.assign({ params: { id: 'sb-1' }, body: { blockId: 'block-1', body: 'Please fix this' } }, REQ_USER);
    handlers.addComment(req, fakeRes())
      .then(function () {
        currentStatus().should.equal('in_review');
        done();
      })
      .catch(done);
  });

  it('moves to Approved once the only comment is resolved', function (done) {
    var addReq = Object.assign({ params: { id: 'sb-1' }, body: { blockId: 'block-1', body: 'Please fix this' } }, REQ_USER);
    handlers.addComment(addReq, fakeRes())
      .then(function () {
        currentStatus().should.equal('in_review');
        var comment = store.storyboardcomment[0];
        var resolveReq = Object.assign({ params: { commentId: comment._id }, body: { resolved: true } }, REQ_USER);
        return handlers.updateComment(resolveReq, fakeRes());
      })
      .then(function () {
        currentStatus().should.equal('approved');
        done();
      })
      .catch(done);
  });

  it('reverts to In Review if a new unresolved comment is added after approval', function (done) {
    var addReq = Object.assign({ params: { id: 'sb-1' }, body: { blockId: 'block-1', body: 'First' } }, REQ_USER);
    handlers.addComment(addReq, fakeRes())
      .then(function () {
        var comment = store.storyboardcomment[0];
        var resolveReq = Object.assign({ params: { commentId: comment._id }, body: { resolved: true } }, REQ_USER);
        return handlers.updateComment(resolveReq, fakeRes());
      })
      .then(function () {
        currentStatus().should.equal('approved');
        var secondReq = Object.assign({ params: { id: 'sb-1' }, body: { blockId: 'block-2', body: 'Second' } }, REQ_USER);
        return handlers.addComment(secondReq, fakeRes());
      })
      .then(function () {
        currentStatus().should.equal('in_review');
        done();
      })
      .catch(done);
  });

  it('reverts to Draft once the last comment is deleted', function (done) {
    var addReq = Object.assign({ params: { id: 'sb-1' }, body: { blockId: 'block-1', body: 'Only comment' } }, REQ_USER);
    handlers.addComment(addReq, fakeRes())
      .then(function () {
        currentStatus().should.equal('in_review');
        var comment = store.storyboardcomment[0];
        var deleteReq = Object.assign({ params: { commentId: comment._id } }, REQ_USER);
        return handlers.deleteComment(deleteReq, fakeRes());
      })
      .then(function () {
        currentStatus().should.equal('draft');
        done();
      })
      .catch(done);
  });

  it('ignores replies when deciding status (only top-level comments count)', function (done) {
    var addReq = Object.assign({ params: { id: 'sb-1' }, body: { blockId: 'block-1', body: 'Top level' } }, REQ_USER);
    handlers.addComment(addReq, fakeRes())
      .then(function () {
        var top = store.storyboardcomment[0];
        var resolveReq = Object.assign({ params: { commentId: top._id }, body: { resolved: true } }, REQ_USER);
        return handlers.updateComment(resolveReq, fakeRes()).then(function () { return top; });
      })
      .then(function (top) {
        currentStatus().should.equal('approved');
        // An unresolved REPLY should not reopen the storyboard.
        var replyReq = Object.assign(
          { params: { id: 'sb-1' }, body: { blockId: 'block-1', body: 'A reply', _parentCommentId: top._id } },
          REQ_USER
        );
        return handlers.addComment(replyReq, fakeRes());
      })
      .then(function () {
        currentStatus().should.equal('approved');
        done();
      })
      .catch(done);
  });
});
