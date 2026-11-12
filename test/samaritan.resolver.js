var should = require('should');

var database = require('../lib/database');
var resolver = require('../plugins/services/samaritan/context/resolver');

// Runs the real resolver against in-memory content, so a missing helper, a broken
// import or a wrong filter shows up here instead of failing every /propose call.

var originalGetDatabase = database.getDatabase;
afterEach(function() { database.getDatabase = originalGetDatabase; });

function matches(doc, search) {
  return Object.keys(search || {}).every(function(key) { return String(doc[key]) === String(search[key]); });
}

function fakeApp(content) {
  var plugins = {};
  Object.keys(content).forEach(function(type) {
    plugins[type] = { retrieve: function(search, opts, cb) { cb(null, content[type].filter(function(d) { return matches(d, search); })); } };
  });
  database.getDatabase = function(cb) {
    cb(null, {
      retrieve: function(collection, search, done) {
        done(null, collection === 'componenttype' ? [{ _id: 'ct-text', component: 'text', displayName: 'Text' }] : []);
      }
    });
  };
  return {
    contentmanager: {
      getContentPlugin: function(type, cb) {
        if (!plugins[type]) return cb(new Error('no plugin ' + type));
        cb(null, plugins[type]);
      }
    }
  };
}

function text(id, blockId, title, body, courseId) {
  return { _id: id, _component: 'text', _parentId: blockId, _courseId: courseId || 'course-1', title: title, body: body || '' };
}

function baseContent(components) {
  return {
    course: [{ _id: 'course-1', title: 'C' }],
    contentobject: [
      { _id: 'menu-1', _type: 'menu', _parentId: 'course-1', _courseId: 'course-1', title: 'Menu' },
      { _id: 'page-1', _type: 'page', _parentId: 'course-1', _courseId: 'course-1', title: 'Page 1' }
    ],
    article: [{ _id: 'art-1', _parentId: 'page-1', _courseId: 'course-1', title: 'Article' }],
    block: [{ _id: 'blk-1', _parentId: 'art-1', _courseId: 'course-1', title: 'Block' }],
    component: components,
    storyboard: []
  };
}

describe('samaritan context resolver', function() {
  it('resolves a course-level context end to end', function() {
    var app = fakeApp(baseContent([text('c1', 'blk-1', 'Intro', '<p>Hello there</p>')]));
    return resolver.resolveContextAsync(app, { courseId: 'course-1' }).then(function(ctx) {
      ctx.course._id.should.equal('course-1');
      ctx.courseSubtree.tree.should.have.length(1);
      ctx.courseSubtree.tree[0].id.should.equal('page-1');
      ctx.courseSubtree.tree[0].articles[0].blocks[0].components[0].bodyPreview.should.equal('Hello there');
      ctx.availableComponentTypes.should.have.length(1);
      ctx.provenance.length.should.be.above(0);
    });
  });

  it('never offers a menu as a page', function() {
    return resolver.resolveContextAsync(fakeApp(baseContent([])), { courseId: 'course-1' }).then(function(ctx) {
      ctx.courseSubtree.tree.map(function(p) { return p.id; }).should.eql(['page-1']);
      ctx.courseSubtree.counts.pages.should.equal(1);
    });
  });

  it('spends one component budget across the whole course, not one per block', function() {
    var content = baseContent([]);
    var blocks = [];
    var components = [];
    for (var i = 0; i < 300; i++) {
      blocks.push({ _id: 'b' + i, _parentId: 'art-1', _courseId: 'course-1', title: 'B' + i });
      components.push(text('c' + i, 'b' + i, 'T' + i));
    }
    content.block = blocks;
    content.component = components;
    return resolver.resolveContextAsync(fakeApp(content), { courseId: 'course-1' }).then(function(ctx) {
      var sent = 0;
      ctx.courseSubtree.tree[0].articles[0].blocks.forEach(function(b) { sent += b.components.length; });
      sent.should.equal(200);
      ctx.courseSubtree.truncated.should.equal(true);
    });
  });

  it('finds the objectives component on any page and flags ambiguity', function() {
    var one = baseContent([text('c1', 'blk-1', 'Welcome'), text('c2', 'blk-1', 'Learning objectives', '<p>x</p>')]);
    return resolver.resolveContextAsync(fakeApp(one), { courseId: 'course-1' }).then(function(ctx) {
      ctx.courseSubtree.objectivesComponent.componentId.should.equal('c2');
      ctx.courseSubtree.objectivesAmbiguous.should.equal(false);
      var two = baseContent([text('c1', 'blk-1', 'Objectives'), text('c2', 'blk-1', 'Learning objectives')]);
      return resolver.resolveContextAsync(fakeApp(two), { courseId: 'course-1' });
    }).then(function(ctx) {
      ctx.courseSubtree.objectivesAmbiguous.should.equal(true);
    });
  });

  it('loads full bodies only for components of this course', function() {
    var content = baseContent([text('c1', 'blk-1', 'Intro', '<p>the full text</p>'), text('other', 'blk-9', 'Other', 'secret', 'course-2')]);
    return resolver.resolveContextAsync(fakeApp(content), { courseId: 'course-1' }).then(function(ctx) {
      return ctx.loadComponentBodies(['c1', 'other']);
    }).then(function(bodies) {
      bodies.c1.body.should.equal('<p>the full text</p>');
      should.not.exist(bodies.other);
    });
  });

  it('puts the selected component and its siblings in a selection context', function() {
    var content = baseContent([text('c1', 'blk-1', 'Intro', '<p>Hello</p>'), text('c2', 'blk-1', 'Second')]);
    return resolver.resolveContextAsync(fakeApp(content), { courseId: 'course-1', selectedType: 'component', selectedId: 'c1' }).then(function(ctx) {
      ctx.selection.type.should.equal('component');
      ctx.selection.entity.body.should.equal('<p>Hello</p>');
      should.equal(ctx.courseSubtree, null);
    });
  });

  it('rejects a component that belongs to another course', function() {
    var content = baseContent([text('x', 'blk-9', 'Other', '', 'course-2')]);
    return resolver.resolveContextAsync(fakeApp(content), { courseId: 'course-1', selectedType: 'component', selectedId: 'x' }).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('COURSE_MISMATCH'); }
    );
  });
});
