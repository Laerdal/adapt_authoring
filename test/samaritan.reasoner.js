var should = require('should');

var provider = require('../plugins/services/samaritan/ai/azureProvider');
var reasoner = require('../plugins/services/samaritan/reasoning/reasoner');

var TYPES = [
  { _id: 'ct-text', component: 'text', displayName: 'Text' },
  { _id: 'ct-graphic', component: 'graphic', displayName: 'Graphic' },
  { _id: 'ct-narrative', component: 'narrative', displayName: 'Narrative' }
];

function blockContext(overrides) {
  return Object.assign(
    {
      course: { _id: 'course-1', title: 'Test Course' },
      selection: { type: 'block', entity: { _id: 'block-1' }, blockId: 'block-1' },
      blockChildren: [],
      courseSubtree: null,
      availableComponentTypes: TYPES,
      availableExtensions: [],
      referenceDocuments: [],
      provenance: []
    },
    overrides
  );
}

function componentContext(component, overrides) {
  return Object.assign(
    {
      course: { _id: 'course-1', title: 'Test Course' },
      selection: { type: 'component', entity: component, blockId: 'block-1' },
      blockChildren: [component],
      courseSubtree: null,
      availableComponentTypes: TYPES,
      availableExtensions: [],
      referenceDocuments: [],
      provenance: []
    },
    overrides
  );
}

function courseLevelContext(overrides) {
  return Object.assign(
    {
      course: { _id: 'course-1', title: 'Test Course' },
      selection: null,
      blockChildren: [],
      courseSubtree: { tree: [], counts: { pages: 0, articles: 0, blocks: 0, components: 0 }, truncated: false },
      availableComponentTypes: TYPES,
      availableExtensions: [{ _id: 'ext-1', name: 'adapt-contrib-spoor' }],
      referenceDocuments: [],
      provenance: []
    },
    overrides
  );
}

var originalComplete = provider.complete;
afterEach(function() { provider.complete = originalComplete; });

function mockToolCall(name, args) {
  provider.complete = function() { return Promise.resolve({ toolCall: { name: name, arguments: args }, text: null }); };
}

describe('samaritan reasoner (full tool dispatch)', function() {
  it('explicit componentType fast path still works without calling the AI provider', function() {
    var called = false;
    provider.complete = function() { called = true; return Promise.reject(new Error('should not be called')); };
    return reasoner.reason(blockContext(), { componentType: 'text' }).then(function(result) {
      result.status.should.equal('PROPOSED');
      result.plan.actions[0].actionType.should.equal('ADD_COMPONENT');
      result.plan.actions[0].parameters._component.should.equal('text');
      called.should.equal(false);
    });
  });

  it('answer_question returns ANSWERED with no action created', function() {
    mockToolCall('answer_question', { answer: 'This course has 3 articles.', sources: ['course structure'] });
    return reasoner.reason(courseLevelContext(), { message: 'What is in this course?' }).then(function(result) {
      result.status.should.equal('ANSWERED');
      result.answer.text.should.equal('This course has 3 articles.');
    });
  });

  it('propose_add_component builds a single-action PROPOSED plan', function() {
    mockToolCall('propose_add_component', { componentType: 'graphic', reason: 'x', confidence: 'high' });
    return reasoner.reason(blockContext(), { message: 'Add a Graphic component here.' }).then(function(result) {
      result.status.should.equal('PROPOSED');
      result.plan.actions.should.have.length(1);
      result.plan.actions[0].parameters._component.should.equal('graphic');
    });
  });

  it('propose_rewrite_content builds a REWRITE_CONTENT action targeting the selected component', function() {
    mockToolCall('propose_rewrite_content', { newContent: 'New body text.', reason: 'x', confidence: 'high' });
    return reasoner.reason(componentContext({ _id: 'comp-1', _component: 'text' }), { message: 'Rewrite this.' }).then(function(result) {
      result.status.should.equal('PROPOSED');
      result.plan.actions[0].actionType.should.equal('REWRITE_CONTENT');
      result.plan.actions[0].target.id.should.equal('comp-1');
      result.plan.actions[0].parameters.content.should.equal('New body text.');
    });
  });

  it('propose_remove_component builds a REMOVE_COMPONENT action', function() {
    mockToolCall('propose_remove_component', { reason: 'x', confidence: 'high' });
    return reasoner.reason(componentContext({ _id: 'comp-1', _component: 'graphic' }), { message: 'Remove this.' }).then(function(result) {
      result.status.should.equal('PROPOSED');
      result.plan.actions[0].actionType.should.equal('REMOVE_COMPONENT');
      result.plan.actions[0].target.id.should.equal('comp-1');
    });
  });

  it('propose_replace_component builds a REPLACE_COMPONENT action for text -> narrative', function() {
    mockToolCall('propose_replace_component', { targetComponentType: 'narrative', reason: 'x', confidence: 'high' });
    return reasoner.reason(componentContext({ _id: 'comp-1', _component: 'text' }), { message: 'Change this to Narrative.' }).then(function(result) {
      result.status.should.equal('PROPOSED');
      result.plan.actions[0].actionType.should.equal('REPLACE_COMPONENT');
      result.plan.actions[0].parameters.targetComponentType.should.equal('narrative');
    });
  });

  it('declines a replace proposal for a target type not in the enabled catalog', function() {
    mockToolCall('propose_replace_component', { targetComponentType: 'video', reason: 'x', confidence: 'high' });
    return reasoner.reason(componentContext({ _id: 'comp-1', _component: 'text' }), { message: 'Change to video.' }).then(function(result) {
      result.status.should.equal('DECLINED');
    });
  });

  it('propose_plugin_action builds an ENABLE_PLUGIN action for an installed extension', function() {
    mockToolCall('propose_plugin_action', { action: 'enable', extensionName: 'adapt-contrib-spoor', reason: 'x', confidence: 'high' });
    return reasoner.reason(courseLevelContext(), { message: 'Enable spoor.' }).then(function(result) {
      result.status.should.equal('PROPOSED');
      result.plan.actions[0].actionType.should.equal('ENABLE_PLUGIN');
      result.plan.actions[0].parameters.extensionIds.should.eql(['ext-1']);
    });
  });

  it('declines a plugin action for an extension that is not installed', function() {
    mockToolCall('propose_plugin_action', { action: 'enable', extensionName: 'not-installed', reason: 'x', confidence: 'high' });
    return reasoner.reason(courseLevelContext(), { message: 'Enable something.' }).then(function(result) {
      result.status.should.equal('DECLINED');
    });
  });

  it('propose_course_outline expands into a dependency-ordered multi-action plan with $ref placeholders', function() {
    mockToolCall('propose_course_outline', {
      title: 'CPR Responder',
      objectives: ['Recognise cardiac arrest'],
      assumptions: ['No reference documents were linked; using general CPR knowledge.'],
      articles: [
        { title: 'Recognising Cardiac Arrest', content: 'Body text 1' },
        { title: 'Chest Compressions', content: 'Body text 2' }
      ],
      reason: 'x',
      confidence: 'high'
    });
    return reasoner.reason(courseLevelContext(), { message: 'Create a CPR course.' }).then(function(result) {
      result.status.should.equal('PLAN_PROPOSED');
      result.intent.assumptions.should.have.length(1);
      // 1 CREATE_COURSE + 2 articles * (article+block+component) = 7 actions
      result.plan.actions.should.have.length(7);
      result.plan.actions[0].actionType.should.equal('CREATE_COURSE');
      var firstArticle = result.plan.actions[1];
      firstArticle.actionType.should.equal('CREATE_ARTICLE');
      firstArticle.target.parentId.should.eql({ $ref: result.plan.actions[0].actionId, path: 'pageId' });
      firstArticle.dependsOn.should.eql([result.plan.actions[0].actionId]);
    });
  });

  it('propose_course_outline reuses an already-empty course (its root page) instead of creating a second one', function() {
    mockToolCall('propose_course_outline', {
      title: 'CPR Responder',
      objectives: ['Recognise cardiac arrest'],
      assumptions: [],
      articles: [{ title: 'Recognising Cardiac Arrest', content: 'Body text 1' }],
      reason: 'x',
      confidence: 'high'
    });
    var emptyShellCourseContext = courseLevelContext({
      course: { _id: 'shell-course-1', title: 'Untitled Course' },
      courseSubtree: {
        tree: [{ id: 'shell-page-1', title: 'Topic 1', articles: [] }],
        counts: { pages: 1, articles: 0, blocks: 0, components: 0 },
        truncated: false
      }
    });
    return reasoner.reason(emptyShellCourseContext, { message: 'Build this course about CPR.' }).then(function(result) {
      result.status.should.equal('PLAN_PROPOSED');
      // No CREATE_COURSE: 1 article * (article+block+component) = 3 actions
      result.plan.actions.should.have.length(3);
      var articleAction = result.plan.actions[0];
      articleAction.actionType.should.equal('CREATE_ARTICLE');
      articleAction.target.parentId.should.equal('shell-page-1');
      articleAction.target.courseId.should.equal('shell-course-1');
      articleAction.dependsOn.should.eql([]);
    });
  });

  it('propose_add_pages expands into CREATE_PAGE -> CREATE_ARTICLE -> CREATE_BLOCK -> ADD_COMPONENT per page, no CREATE_COURSE', function() {
    mockToolCall('propose_add_pages', {
      pages: [
        { title: 'Airway Management', articles: [{ title: 'Positioning', content: 'Body text 1' }] },
        { title: 'Circulation', articles: [{ title: 'Pulse Checks', content: 'Body text 2' }] }
      ],
      reason: 'x',
      confidence: 'high'
    });
    return reasoner.reason(courseLevelContext(), { message: 'Create 2 new pages for this course.' }).then(function(result) {
      result.status.should.equal('PLAN_PROPOSED');
      // 2 pages * (page+article+block+component) = 8 actions, no CREATE_COURSE
      result.plan.actions.should.have.length(8);
      result.plan.actions[0].actionType.should.equal('CREATE_PAGE');
      result.plan.actions[0].target.courseId.should.equal('course-1');
      var firstArticle = result.plan.actions[1];
      firstArticle.actionType.should.equal('CREATE_ARTICLE');
      firstArticle.target.parentId.should.eql({ $ref: result.plan.actions[0].actionId, path: 'pageId' });
      result.plan.actions[4].actionType.should.equal('CREATE_PAGE');
    });
  });

  it('conversationHistory is threaded into the composed messages sent to the AI provider', function() {
    var capturedMessages = null;
    provider.complete = function(opts) {
      capturedMessages = opts.messages;
      return Promise.resolve({ toolCall: { name: 'answer_question', arguments: { answer: 'ok' } }, text: null });
    };
    var history = [
      { role: 'assistant', content: 'Which component type would you like?' },
      { role: 'user', content: 'A text component.' }
    ];
    return reasoner.reason(blockContext(), { message: 'Yes, go ahead.', conversationHistory: history }).then(function() {
      capturedMessages.some(function(m) { return m.role === 'assistant' && m.content === 'Which component type would you like?'; }).should.equal(true);
      capturedMessages.some(function(m) { return m.role === 'user' && m.content === 'A text component.'; }).should.equal(true);
      // the new message is still last
      capturedMessages[capturedMessages.length - 1].should.eql({ role: 'user', content: 'Yes, go ahead.' });
    });
  });

  it('draft_objectives returns OBJECTIVES_DRAFTED with a filtered, non-empty-only list', function() {
    mockToolCall('draft_objectives', { objectives: ['Explain X', '  ', 'Demonstrate Y', 42] });
    return reasoner.reason(courseLevelContext(), { message: 'Draft objectives for a course about X and Y.' }).then(function(result) {
      result.status.should.equal('OBJECTIVES_DRAFTED');
      result.objectives.should.eql(['Explain X', 'Demonstrate Y']);
    });
  });

  it('propose_course_outline adds an MCQ component per article when mcq data is provided, and a trailing assessment page', function() {
    var TYPES_WITH_MCQ = TYPES.concat([{ _id: 'ct-mcq', component: 'mcq', displayName: 'MCQ' }]);
    mockToolCall('propose_course_outline', {
      title: 'CPR Responder',
      objectives: ['Recognise cardiac arrest'],
      assumptions: [],
      articles: [
        {
          title: 'Recognising Cardiac Arrest',
          content: 'Body text 1',
          mcq: { question: 'What is the first sign?', options: [{ text: 'Unresponsiveness', correct: true, feedback: 'Correct.' }, { text: 'Fever', correct: false, feedback: 'Not quite.' }] }
        }
      ],
      assessmentQuestions: [{ question: 'Final Q1', options: [{ text: 'A', correct: true }, { text: 'B', correct: false }] }],
      assessmentLabel: 'Formal Assessment',
      reason: 'x',
      confidence: 'high'
    });
    return reasoner.reason(courseLevelContext({ availableComponentTypes: TYPES_WITH_MCQ }), { message: 'Create a CPR course with knowledge checks and a final assessment.' }).then(function(result) {
      result.status.should.equal('PLAN_PROPOSED');
      var types = result.plan.actions.map(function(a) { return a.actionType; });
      // CREATE_COURSE, CREATE_ARTICLE, CREATE_BLOCK, ADD_COMPONENT(text), ADD_COMPONENT(mcq), then assessment page chain (PAGE, ARTICLE, BLOCK, ADD_COMPONENT x1)
      types.should.eql(['CREATE_COURSE', 'CREATE_ARTICLE', 'CREATE_BLOCK', 'ADD_COMPONENT', 'ADD_COMPONENT', 'CREATE_PAGE', 'CREATE_ARTICLE', 'CREATE_BLOCK', 'ADD_COMPONENT']);

      var mcqAction = result.plan.actions[4];
      mcqAction.parameters._component.should.equal('mcq');
      mcqAction.parameters.displayTitle.should.equal('What is the first sign?');
      mcqAction.parameters.properties._items.should.have.length(2);
      mcqAction.parameters.properties._items[0]._shouldBeSelected.should.equal(true);

      var assessmentPageAction = result.plan.actions[5];
      assessmentPageAction.parameters.title.should.equal('Formal Assessment');

      var assessmentMcqAction = result.plan.actions[8];
      assessmentMcqAction.parameters._component.should.equal('mcq');
      assessmentMcqAction.parameters.properties._items[0].text.should.equal('A');
    });
  });

  it('propose_course_outline omits MCQ actions when no mcq component type is installed, even if the model returns mcq data', function() {
    mockToolCall('propose_course_outline', {
      title: 'CPR Responder',
      objectives: ['x'],
      assumptions: [],
      articles: [{ title: 'A', content: 'Body', mcq: { question: 'Q?', options: [{ text: 'A', correct: true }] } }],
      reason: 'x',
      confidence: 'high'
    });
    return reasoner.reason(courseLevelContext(), { message: 'Create a course.' }).then(function(result) {
      result.plan.actions.map(function(a) { return a.actionType; }).should.eql(['CREATE_COURSE', 'CREATE_ARTICLE', 'CREATE_BLOCK', 'ADD_COMPONENT']);
    });
  });

  it('decline is routed through with a valid engineering-agent category', function() {
    mockToolCall('decline', { reason: 'Creating a new component type requires source code changes.', category: 'requires_engineering_agent' });
    return reasoner.reason(courseLevelContext(), { message: 'Create a new component type.' }).then(function(result) {
      result.status.should.equal('DECLINED');
      result.declined.category.should.equal('requires_engineering_agent');
    });
  });

  it('ask_clarification is routed through unchanged', function() {
    mockToolCall('ask_clarification', { question: 'Which component type would you like?' });
    return reasoner.reason(blockContext(), { message: 'Add a component here.' }).then(function(result) {
      result.status.should.equal('CLARIFICATION_REQUIRED');
    });
  });

  it('declines (not throws) when the model responds with plain text instead of a tool call', function() {
    provider.complete = function() { return Promise.resolve({ toolCall: null, text: 'Sure!' }); };
    return reasoner.reason(blockContext(), { message: 'Add something.' }).then(function(result) {
      result.status.should.equal('DECLINED');
    });
  });

  it('declines (not throws) on malformed tool-call arguments from the provider', function() {
    provider.complete = function() {
      var err = new Error('bad json');
      err.code = 'AI_MALFORMED_RESPONSE';
      return Promise.reject(err);
    };
    return reasoner.reason(blockContext(), { message: 'Add a text component.' }).then(function(result) {
      result.status.should.equal('DECLINED');
    });
  });

  it('rejects with AI_REASONING_UNAVAILABLE when the provider itself fails', function() {
    provider.complete = function() {
      var err = new Error('not configured');
      err.code = 'AI_NOT_CONFIGURED';
      return Promise.reject(err);
    };
    return reasoner.reason(blockContext(), { message: 'Add a text component.' }).then(
      function() { throw new Error('expected rejection'); },
      function(err) { err.code.should.equal('AI_REASONING_UNAVAILABLE'); }
    );
  });

  it('asks for clarification when there is no message and no explicit type', function() {
    return reasoner.reason(blockContext(), {}).then(function(result) {
      result.status.should.equal('CLARIFICATION_REQUIRED');
    });
  });
});
