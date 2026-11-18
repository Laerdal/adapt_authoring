var should = require('should');

var provider = require('../plugins/services/samaritan/ai/azureProvider');
var reasoner = require('../plugins/services/samaritan/reasoning/reasoner');
var tools = require('../plugins/services/samaritan/ai/tools');
var policy = require('../plugins/services/samaritan/actions/policy');

var TYPES = [
  { _id: 'ct-text', component: 'text', displayName: 'Text' },
  { _id: 'ct-mcq', component: 'mcq', displayName: 'Multiple Choice' }
];

function context(tree) {
  return {
    course: { _id: 'course-1', title: 'Test Course' },
    selection: null,
    blockChildren: [],
    courseSubtree: {
      tree: tree || [],
      counts: { pages: 1, articles: 0, blocks: 0, components: 0 },
      truncated: false,
      objectivesComponent: null
    },
    availableComponentTypes: TYPES,
    availableExtensions: [],
    referenceDocuments: [],
    provenance: []
  };
}

var originalComplete = provider.complete;
function mockToolCall(name, args) {
  provider.complete = function() { return Promise.resolve({ toolCall: { name: name, arguments: args }, text: null }); };
}

function acts(types) { return types.map(function(t) { return { actionType: t }; }); }

describe('samaritan QA fixes', function() {
  afterEach(function() { provider.complete = originalComplete; });

  describe('explainPlanRisk (why a plan is rated as it is)', function() {
    it('explains a large create-only plan in authoring terms: size, and that nothing existing changes', function() {
      var big = acts(['CREATE_PAGE'].concat(Array(10).fill('CREATE_ARTICLE'), Array(10).fill('ADD_COMPONENT')));
      var reasons = policy.explainPlanRisk(big);
      reasons.join(' ').should.match(/21 changes at once/);
      reasons.join(' ').should.match(/rated one level higher/);
      reasons.join(' ').should.match(/only adds new content/);
      reasons.join(' ').should.not.match(/CREATE_|ADD_COMPONENT/);
    });

    it('says when a plan creates a course, removes content, or changes an extension', function() {
      policy.explainPlanRisk(acts(['CREATE_COURSE'])).join(' ').should.match(/creates a new course/);
      policy.explainPlanRisk(acts(['REMOVE_COMPONENT'])).join(' ').should.match(/removes or replaces content that already exists/);
      policy.explainPlanRisk(acts(['ENABLE_PLUGIN'])).join(' ').should.match(/extension on or off/);
    });

    it('does not claim "only adds" for a plan that edits or removes, and flags an unknown action as high risk', function() {
      policy.explainPlanRisk(acts(['REWRITE_CONTENT'])).join(' ').should.match(/edits existing content/);
      policy.explainPlanRisk(acts(['REWRITE_CONTENT'])).join(' ').should.not.match(/only adds/);
      policy.explainPlanRisk(acts(['REMOVE_COMPONENT'])).join(' ').should.not.match(/only adds/);
      policy.explainPlanRisk(acts(['SOMETHING_NEW'])).join(' ').should.match(/not recognised as routine/);
    });

    it('has one short reason for a single small addition and none for no actions', function() {
      policy.explainPlanRisk(acts(['ADD_COMPONENT'])).should.eql(['It only adds new content. Nothing that already exists in the course is changed or removed.']);
      policy.explainPlanRisk([]).should.eql([]);
    });

    it('agrees with the rating: a plan of more than 5 changes is HIGH, and the reasons say why', function() {
      var six = acts(Array(6).fill('ADD_COMPONENT'));
      policy.policyForPlan(six).risk.should.equal('HIGH');
      policy.explainPlanRisk(six).join(' ').should.match(/more than 5/);
    });
  });

  describe('draft_objectives and the attached source material', function() {
    var empty = function() { return context([]); };

    it('offers a sourceUse choice the model can set', function() {
      var t = tools.buildTools(empty()).filter(function(d) { return d.function.name === 'draft_objectives'; })[0];
      t.function.parameters.properties.sourceUse.enum.should.eql(['used', 'partly', 'unrelated', 'unusable']);
    });

    it('passes on whether the source was used, with the model\'s note', function() {
      mockToolCall('draft_objectives', { objectives: ['Explain hand hygiene'], title: 'Hand Hygiene', sourceUse: 'unrelated', sourceNote: 'The file is a cooking guide.' });
      return reasoner.reason(empty(), { message: 'Draft objectives' }).then(function(r) {
        r.status.should.equal('OBJECTIVES_DRAFTED');
        r.sourceUse.should.equal('unrelated');
        r.sourceNote.should.equal('The file is a cooking guide.');
      });
    });

    it('ignores a sourceUse it does not know, and omits it when none is given', function() {
      mockToolCall('draft_objectives', { objectives: ['A'], sourceUse: 'completely-used' });
      return reasoner.reason(empty(), { message: 'Draft objectives' }).then(function(r) {
        should.not.exist(r.sourceUse);
        mockToolCall('draft_objectives', { objectives: ['A'] });
        return reasoner.reason(empty(), { message: 'Draft objectives' });
      }).then(function(r) {
        should.not.exist(r.sourceUse);
      });
    });
  });

  describe('MCQ instruction', function() {
    it('is written as plain text, never the raw Handlebars default', function() {
      var tree = [{ id: 'page-1', title: 'P', articles: [{ id: 'art-1', title: 'A', blocks: [] }] }];
      mockToolCall('propose_add_content', {
        articleId: 'art-1',
        sections: [{ title: 'CPR', content: '<p>x</p>', mcq: { question: 'Q?', options: [{ text: 'Yes', correct: true }, { text: 'No', correct: false }] } }],
        reason: 'x',
        confidence: 'high'
      });
      return reasoner.reason(context(tree), { message: 'add a section with an MCQ' }).then(function(r) {
        var mcq = r.plan.actions.filter(function(a) { return a.parameters._component === 'mcq'; })[0];
        mcq.parameters.properties.instruction.should.equal('Select one option and then select Submit.');
        mcq.parameters.properties.instruction.should.not.containEql('{{');
      });
    });
  });
});
