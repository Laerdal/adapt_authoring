var should = require('should');

var provider = require('../plugins/services/samaritan/ai/azureProvider');
var reasoner = require('../plugins/services/samaritan/reasoning/reasoner');
var tools = require('../plugins/services/samaritan/ai/tools');
var promptComposer = require('../plugins/services/samaritan/ai/promptComposer');

var TYPES = [
  { _id: 'ct-text', component: 'text', displayName: 'Text' },
  { _id: 'ct-mcq', component: 'mcq', displayName: 'Multiple Choice' }
];

var MCQ = {
  question: 'What does CPR stand for?',
  options: [
    { text: 'Cardiopulmonary resuscitation', correct: true },
    { text: 'Cardiac pressure recovery', correct: false },
    { text: 'Central pulse response', correct: false }
  ]
};

function context(overrides) {
  return Object.assign(
    {
      course: { _id: 'course-1', title: 'Test Course' },
      selection: null,
      blockChildren: [],
      courseSubtree: {
        tree: [
          {
            id: 'page-1', title: 'Page 1',
            articles: [{
              id: 'art-1', title: 'Article 1',
              blocks: [{ id: 'blk-1', title: 'Block 1', components: [
                { id: 'cmp-1', type: 'text', title: 'Intro', bodyPreview: 'Hello' },
                { id: 'cmp-2', type: 'graphic', title: 'Photo', bodyPreview: '' }
              ] }]
            }]
          },
          { id: 'page-2', title: 'Page 2', articles: [] }
        ],
        counts: { pages: 2, articles: 1, blocks: 1, components: 2 },
        truncated: false,
        objectivesComponent: null
      },
      availableComponentTypes: TYPES,
      availableExtensions: [],
      referenceDocuments: [],
      provenance: []
    },
    overrides
  );
}

var originalComplete = provider.complete;
function mockToolCall(name, args) {
  provider.complete = function() { return Promise.resolve({ toolCall: { name: name, arguments: args }, text: null }); };
}
function types(result) { return result.plan.actions.map(function(a) { return a.actionType; }); }

describe('samaritan course-level writes (no selection)', function() {
  afterEach(function() { provider.complete = originalComplete; });

  it('offers the course-level write tools only when nothing is selected', function() {
    var names = function(ctx) { return tools.buildTools(ctx).map(function(d) { return d.function.name; }); };
    names(context()).should.containDeep(['propose_add_content', 'propose_rewrite_components', 'propose_update_objectives']);
    names(context({ selection: { type: 'block' } })).should.not.containEql('propose_add_content');
  });

  it('keeps the read-only draft_objectives tool for empty courses only, so populated courses use the write tool', function() {
    var names = function(ctx) { return tools.buildTools(ctx).map(function(d) { return d.function.name; }); };
    names(context()).should.not.containEql('draft_objectives');
    var empty = context({ courseSubtree: { tree: [], counts: { pages: 1, articles: 0, blocks: 0, components: 0 }, truncated: false, objectivesComponent: null } });
    names(empty).should.containEql('draft_objectives');
  });

  it('adds new blocks (text + MCQ) after the existing blocks of an article', function() {
    mockToolCall('propose_add_content', { articleId: 'art-1', sections: [{ title: 'CPR', mcq: MCQ }], reason: 'x', confidence: 'high' });
    return reasoner.reason(context(), { message: 'add a new block below with an MCQ' }).then(function(result) {
      result.status.should.equal('PLAN_PROPOSED');
      types(result).should.eql(['CREATE_BLOCK', 'ADD_COMPONENT']);
      result.plan.actions[0].target.parentId.should.equal('art-1');
      result.plan.actions[1].target.parentId.$ref.should.equal(result.plan.actions[0].actionId);
      result.plan.actions[1].parameters.properties._items.should.have.length(3);
    });
  });

  it('adds an article + block + components under a page', function() {
    mockToolCall('propose_add_content', { pageId: 'page-2', sections: [{ title: 'More', content: 'Body', mcq: MCQ }], reason: 'x', confidence: 'high' });
    return reasoner.reason(context(), { message: 'add a section to page 2' }).then(function(result) {
      types(result).should.eql(['CREATE_ARTICLE', 'CREATE_BLOCK', 'ADD_COMPONENT', 'ADD_COMPONENT']);
    });
  });

  it('adds components straight into an existing block with a literal parent id', function() {
    mockToolCall('propose_add_content', { blockId: 'blk-1', sections: [{ title: 'Check', mcq: MCQ }], reason: 'x', confidence: 'high' });
    return reasoner.reason(context(), { message: 'add a question to block 1' }).then(function(result) {
      types(result).should.eql(['ADD_COMPONENT']);
      result.plan.actions[0].target.parentId.should.equal('blk-1');
      result.plan.actions[0].dependsOn.should.eql([]);
    });
  });

  it('declines an id that is not in the course tree, and a request naming two parents', function() {
    mockToolCall('propose_add_content', { articleId: 'invented', sections: [{ title: 'x', content: 'y' }], reason: 'x', confidence: 'high' });
    return reasoner.reason(context(), { message: 'x' }).then(function(result) {
      result.status.should.equal('DECLINED');
      result.declined.category.should.equal('invalid_target');
      mockToolCall('propose_add_content', { articleId: 'art-1', pageId: 'page-1', sections: [{ title: 'x', content: 'y' }], reason: 'x', confidence: 'high' });
      return reasoner.reason(context(), { message: 'x' });
    }).then(function(result) {
      result.status.should.equal('DECLINED');
    });
  });

  it('declines an MCQ section when no MCQ component type is installed', function() {
    mockToolCall('propose_add_content', { articleId: 'art-1', sections: [{ title: 'CPR', mcq: MCQ }], reason: 'x', confidence: 'high' });
    return reasoner.reason(context({ availableComponentTypes: [TYPES[0]] }), { message: 'x' }).then(function(result) {
      result.status.should.equal('DECLINED');
    });
  });

  it('rewrites existing Text components by id and refuses other component types', function() {
    mockToolCall('propose_rewrite_components', { rewrites: [{ componentId: 'cmp-1', newContent: '<p>Better</p>' }], reason: 'x', confidence: 'high' });
    return reasoner.reason(context(), { message: 'improve intro' }).then(function(result) {
      result.status.should.equal('PLAN_PROPOSED');
      result.plan.actions[0].actionType.should.equal('REWRITE_CONTENT');
      result.plan.actions[0].target.should.containEql({ type: 'component', id: 'cmp-1', courseId: 'course-1' });
      mockToolCall('propose_rewrite_components', { rewrites: [{ componentId: 'cmp-2', newContent: 'x' }], reason: 'x', confidence: 'high' });
      return reasoner.reason(context(), { message: 'x' });
    }).then(function(result) {
      result.status.should.equal('DECLINED');
      result.declined.category.should.equal('unsupported_action');
    });
  });

  it('updates objectives where the course already keeps them, on any page', function() {
    var ctx = context();
    ctx.courseSubtree.objectivesComponent = { componentId: 'cmp-9', title: 'Learning objectives', blockId: 'blk-9' };
    mockToolCall('propose_update_objectives', { objectives: ['Explain CPR', 'Perform <compressions>'], reason: 'x', confidence: 'high' });
    return reasoner.reason(ctx, { message: 'improve objectives' }).then(function(result) {
      types(result).should.eql(['REWRITE_CONTENT']);
      result.plan.actions[0].target.id.should.equal('cmp-9');
      result.plan.actions[0].parameters.content.should.containEql('<li>Explain CPR</li>').and.containEql('&lt;compressions&gt;');
    });
  });

  it('adds a Learning objectives block to the first article when none exist', function() {
    mockToolCall('propose_update_objectives', { objectives: ['Explain CPR'], reason: 'x', confidence: 'high' });
    return reasoner.reason(context(), { message: 'add objectives' }).then(function(result) {
      types(result).should.eql(['CREATE_BLOCK', 'ADD_COMPONENT']);
      result.plan.actions[0].target.parentId.should.equal('art-1');
      result.intent.assumptions.should.have.length(1);
    });
  });

  it('creates an article too when the first page has none', function() {
    var ctx = context();
    ctx.courseSubtree.tree = [{ id: 'page-1', title: 'Page 1', articles: [] }];
    mockToolCall('propose_update_objectives', { objectives: ['Explain CPR'], reason: 'x', confidence: 'high' });
    return reasoner.reason(ctx, { message: 'add objectives' }).then(function(result) {
      types(result).should.eql(['CREATE_ARTICLE', 'CREATE_BLOCK', 'ADD_COMPONENT']);
    });
  });

  it('gives the model ids and body previews to target existing content', function() {
    var messages = promptComposer.composeMessages(context(), 'hi', []);
    var text = messages.map(function(m) { return m.content; }).join('\n');
    text.should.containEql('[articleId: art-1]').and.containEql('[componentId: cmp-1]').and.containEql('- "Hello"');
    text.should.containEql('No existing learning objectives were found anywhere in the course.');
  });
});
