var should = require('should');

var composer = require('../plugins/services/samaritan/ai/promptComposer');

function buildBlockContext() {
  return {
    course: { _id: 'course-1', title: 'CPR Responder', _tenantId: 'secret-tenant', password: 'should-never-leak' },
    selection: { type: 'block', entity: { _id: 'block-1' }, blockId: 'block-1' },
    blockChildren: [{ _id: 'comp-1', _component: 'text', title: 'Intro' }],
    courseSubtree: null,
    availableComponentTypes: [
      { _id: 'ct-text', component: 'text', displayName: 'Text' },
      { _id: 'ct-graphic', component: 'graphic', displayName: 'Graphic' }
    ],
    availableExtensions: [{ name: 'adapt-contrib-spoor' }],
    referenceDocuments: []
  };
}

function buildCourseLevelContext() {
  return {
    course: { _id: 'course-1', title: 'CPR Responder' },
    selection: null,
    blockChildren: [],
    courseSubtree: {
      tree: [{ id: 'p1', title: 'Menu', articles: [{ id: 'a1', title: 'Intro', blocks: [{ id: 'b1', title: 'B1', components: [{ id: 'c1', type: 'text', title: 'Welcome' }] }] }] }],
      counts: { pages: 1, articles: 1, blocks: 1, components: 1 },
      truncated: false
    },
    availableComponentTypes: [{ _id: 'ct-text', component: 'text', displayName: 'Text' }],
    availableExtensions: [],
    referenceDocuments: [{ id: 'doc-1', title: 'CPR Guidelines 2025' }]
  };
}

describe('samaritan prompt composer', function() {
  it('should build one message per conceptual section plus the user request, not one blob', function() {
    var messages = composer.composeMessages(buildBlockContext(), 'Add a Text component here.');
    messages.filter(function(m) { return m.role === 'system'; }).length.should.be.above(1);
    messages[messages.length - 1].should.eql({ role: 'user', content: 'Add a Text component here.' });
  });

  it('should include the course title, selected block id, existing children and type catalog for a block selection', function() {
    var messages = composer.composeMessages(buildBlockContext(), 'x');
    var joined = messages.map(function(m) { return m.content; }).join('\n');
    joined.should.containEql('CPR Responder');
    joined.should.containEql('block-1');
    joined.should.containEql('Intro');
    joined.should.containEql('graphic');
  });

  it('should describe the course subtree and reference documents when there is no selection', function() {
    var messages = composer.composeMessages(buildCourseLevelContext(), 'What is in this course?');
    var joined = messages.map(function(m) { return m.content; }).join('\n');
    joined.should.containEql('Nothing is currently selected');
    joined.should.containEql('Welcome');
    joined.should.containEql('CPR Guidelines 2025');
  });

  it('should never leak tenant/session/credential-shaped fields into the prompt', function() {
    var messages = composer.composeMessages(buildBlockContext(), 'x');
    var joined = messages.map(function(m) { return m.content; }).join('\n');
    joined.should.not.containEql('secret-tenant');
    joined.should.not.containEql('should-never-leak');
  });

  it('should state the engineering-boundary and replacement-scope limitations in safety/limitations', function() {
    var messages = composer.composeMessages(buildBlockContext(), 'x');
    var joined = messages.map(function(m) { return m.content; }).join('\n');
    joined.toLowerCase().should.containEql('never guess');
    joined.toLowerCase().should.containEql('engineering agent');
  });
});
