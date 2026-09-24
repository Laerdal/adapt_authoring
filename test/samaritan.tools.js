var should = require('should');

var tools = require('../plugins/services/samaritan/ai/tools');

var TYPES = [
  { component: 'text', displayName: 'Text' },
  { component: 'graphic', displayName: 'Graphic' }
];

function names(defs) { return defs.map(function(d) { return d.function.name; }); }

describe('samaritan ai tools (context-conditional action vocabulary)', function() {
  it('should always offer answer_question, ask_clarification and decline', function() {
    var defs = tools.buildTools({ selection: null, availableComponentTypes: [], availableExtensions: [] });
    names(defs).should.containDeep(['answer_question', 'ask_clarification', 'decline']);
  });

  it('should only offer propose_add_component when a block is selected', function() {
    var withBlock = tools.buildTools({ selection: { type: 'block' }, availableComponentTypes: TYPES, availableExtensions: [] });
    names(withBlock).should.containEql('propose_add_component');

    var noSelection = tools.buildTools({ selection: null, availableComponentTypes: TYPES, availableExtensions: [] });
    names(noSelection).should.not.containEql('propose_add_component');
  });

  it('should build the componentType enum for propose_add_component from the server-resolved catalog only', function() {
    var defs = tools.buildTools({ selection: { type: 'block' }, availableComponentTypes: TYPES, availableExtensions: [] });
    var addDef = defs.find(function(d) { return d.function.name === 'propose_add_component'; });
    addDef.function.parameters.properties.componentType.enum.should.eql(['text', 'graphic']);
  });

  it('should only offer propose_rewrite_content/propose_remove_component when a component is selected', function() {
    var withComponent = tools.buildTools({
      selection: { type: 'component', entity: { _component: 'graphic' } },
      availableComponentTypes: TYPES,
      availableExtensions: []
    });
    names(withComponent).should.containEql('propose_rewrite_content');
    names(withComponent).should.containEql('propose_remove_component');
  });

  it('should only offer propose_replace_component when the selected component is a text component', function() {
    var textSelected = tools.buildTools({
      selection: { type: 'component', entity: { _component: 'text' } },
      availableComponentTypes: TYPES,
      availableExtensions: []
    });
    names(textSelected).should.containEql('propose_replace_component');

    var graphicSelected = tools.buildTools({
      selection: { type: 'component', entity: { _component: 'graphic' } },
      availableComponentTypes: TYPES,
      availableExtensions: []
    });
    names(graphicSelected).should.not.containEql('propose_replace_component');
  });

  it('should constrain propose_replace_component to narrative only (the only supported target)', function() {
    var defs = tools.buildTools({
      selection: { type: 'component', entity: { _component: 'text' } },
      availableComponentTypes: TYPES,
      availableExtensions: []
    });
    var replaceDef = defs.find(function(d) { return d.function.name === 'propose_replace_component'; });
    replaceDef.function.parameters.properties.targetComponentType.enum.should.eql(['narrative']);
  });

  it('should only offer propose_course_outline when there is no selection and the course is empty', function() {
    var emptyCourseSubtree = { tree: [{ id: 'page-1', title: 'Topic 1', articles: [] }], counts: { pages: 1, articles: 0, blocks: 0, components: 0 }, truncated: false };
    var noSelection = tools.buildTools({ selection: null, courseSubtree: emptyCourseSubtree, availableComponentTypes: [], availableExtensions: [] });
    names(noSelection).should.containEql('propose_course_outline');

    var withBlock = tools.buildTools({ selection: { type: 'block' }, courseSubtree: null, availableComponentTypes: [], availableExtensions: [] });
    names(withBlock).should.not.containEql('propose_course_outline');
  });

  it('should NOT offer propose_course_outline once the course already has real content, offering only propose_add_pages', function() {
    var populatedCourseSubtree = { tree: [{ id: 'page-1', title: 'Topic 1', articles: [{}] }], counts: { pages: 1, articles: 1, blocks: 1, components: 1 }, truncated: false };
    var populated = tools.buildTools({ selection: null, courseSubtree: populatedCourseSubtree, availableComponentTypes: [], availableExtensions: [] });
    names(populated).should.not.containEql('propose_course_outline');
    names(populated).should.containEql('propose_add_pages');
  });

  it('should only offer draft_objectives when there is no selection', function() {
    var noSelection = tools.buildTools({ selection: null, availableComponentTypes: [], availableExtensions: [] });
    names(noSelection).should.containEql('draft_objectives');

    var withBlock = tools.buildTools({ selection: { type: 'block' }, availableComponentTypes: [], availableExtensions: [] });
    names(withBlock).should.not.containEql('draft_objectives');
  });

  it('should only offer propose_add_pages when there is no selection, alongside propose_course_outline', function() {
    var noSelection = tools.buildTools({ selection: null, availableComponentTypes: [], availableExtensions: [] });
    names(noSelection).should.containEql('propose_add_pages');

    var withBlock = tools.buildTools({ selection: { type: 'block' }, availableComponentTypes: [], availableExtensions: [] });
    names(withBlock).should.not.containEql('propose_add_pages');
  });

  it('should only offer propose_plugin_action when at least one extension is installed', function() {
    var withExtensions = tools.buildTools({ selection: null, availableComponentTypes: [], availableExtensions: [{ name: 'adapt-contrib-spoor' }] });
    names(withExtensions).should.containEql('propose_plugin_action');

    var withoutExtensions = tools.buildTools({ selection: null, availableComponentTypes: [], availableExtensions: [] });
    names(withoutExtensions).should.not.containEql('propose_plugin_action');
  });

  it('should constrain decline to the three known categories including requires_engineering_agent', function() {
    var defs = tools.buildTools({ selection: null, availableComponentTypes: [], availableExtensions: [] });
    var declineDef = defs.find(function(d) { return d.function.name === 'decline'; });
    declineDef.function.parameters.properties.category.enum.should.eql(['unsupported_action', 'invalid_target', 'requires_engineering_agent']);
  });
});
