// Unit tests for the Storyboard DOCX import pipeline (ADAPT-3760).
// Pure function tests — build small in-memory .docx buffers with the `docx`
// package (round-tripped through the real Mammoth conversion), then assert on
// the NormalizedDocument / BlockNote output. No app boot / DB / auth needed —
// parsing is independent of persistence (kept that way deliberately).

var should = require('should');
var {
  Document, Packer, Paragraph, HeadingLevel, TextRun, ExternalHyperlink,
  ImageRun, Table, TableRow, TableCell, LevelFormat, AlignmentType,
} = require('docx');

var { parseDocxToNormalizedDocument } = require('../plugins/content/storyboard/utils/normalize/docxNormalizer');
var { normalizedDocumentToBlockNote } = require('../plugins/content/storyboard/utils/normalize/toBlockNote');
var { sanitizeMammothHtml } = require('../plugins/content/storyboard/utils/normalize/htmlSanitizer');
var { buildCustomProperties, readDocxMetadata } = require('../plugins/content/storyboard/utils/normalize/reimportMetadata');

var ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function buildDocx(sectionChildren, docOptions) {
  var doc = new Document(Object.assign({ sections: [{ children: sectionChildren }] }, docOptions || {}));
  return Packer.toBuffer(doc);
}

function findBlocks(blocks, type) {
  return blocks.filter(function (b) { return b.type === type; });
}

function findSbComponents(blocks, kind) {
  return findBlocks(blocks, 'sbComponent')
    .filter(function (b) { return b.props.kind === kind; })
    .map(function (b) { return Object.assign({}, b, { data: JSON.parse(b.props.data) }); });
}

describe('storyboard docx import', function () {
  describe('heading levels', function () {
    it('preserves H1-H4 and clamps H5/H6 down to H4', function (done) {
      buildDocx([
        new Paragraph({ text: 'One', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: 'Two', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: 'Three', heading: HeadingLevel.HEADING_3 }),
        new Paragraph({ text: 'Four', heading: HeadingLevel.HEADING_4 }),
        new Paragraph({ text: 'Five', heading: HeadingLevel.HEADING_5 }),
        new Paragraph('Body text so the deepest heading is not pruned as empty.'),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer, { sourceFileName: 'h.docx' }).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var headings = findBlocks(blocks, 'heading');
          headings.length.should.equal(5);
          headings[0].props.level.should.equal(1);
          headings[3].props.level.should.equal(4);
          headings[4].props.level.should.equal(4); // clamped, not dropped
          done();
        }).catch(done);
      }).catch(done);
    });

    it('drops a heading (and its ancestors) that end up with no content anywhere underneath', function (done) {
      buildDocx([
        new Paragraph({ text: 'Empty Topic', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: 'Real Topic', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: 'Section', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: 'Group', heading: HeadingLevel.HEADING_3 }),
        new Paragraph('Some real content.'),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var headings = findBlocks(blocks, 'heading');
          headings.length.should.equal(3);
          headings[0].content[0].text.should.equal('Real Topic');
          headings.some(function (h) { return h.content[0].text === 'Empty Topic'; }).should.equal(false);
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('hierarchy gap-filling', function () {
    it('inserts visible, editable placeholder headings when content skips required levels', function (done) {
      buildDocx([
        new Paragraph({ text: 'Module One', heading: HeadingLevel.HEADING_1 }),
        new Paragraph('Body text directly under the topic, with no Section or Content Group heading.'),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var headings = findBlocks(blocks, 'heading');
          headings.length.should.equal(3);
          headings[0].props.level.should.equal(1);
          headings[0].content[0].text.should.equal('Module One');
          headings[1].props.level.should.equal(2);
          headings[1].content[0].text.should.equal('Untitled Section');
          headings[2].props.level.should.equal(3);
          headings[2].content[0].text.should.equal('Untitled Content Group');
          var para = findBlocks(blocks, 'paragraph')[0];
          para.content[0].text.should.equal('Body text directly under the topic, with no Section or Content Group heading.');
          normalized.metadata.warnings.some(function (w) { return w.code === 'synthesized-heading'; }).should.equal(true);
          done();
        }).catch(done);
      }).catch(done);
    });

    it('does not insert filler headings when the full Topic/Section/Content Group chain is already authored', function (done) {
      buildDocx([
        new Paragraph({ text: 'Module', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: 'Section', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: 'Group', heading: HeadingLevel.HEADING_3 }),
        new Paragraph('Body text.'),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          findBlocks(blocks, 'heading').length.should.equal(3);
          normalized.metadata.warnings.some(function (w) { return w.code === 'synthesized-heading'; }).should.equal(false);
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('export/re-import round trip', function () {
    it('does not treat the exported course title as stray body content (regression: bogus Introduction/Untitled Section/Untitled Content Group)', function (done) {
      var convert = require('../plugins/content/storyboard/utils/documentConvert');
      var blocks = [
        { type: 'heading', props: { level: 1 }, content: 'Head-tilt and chin-lift' },
        { type: 'heading', props: { level: 2 }, content: 'Airway Management' },
        { type: 'heading', props: { level: 3 }, content: 'Procedure' },
        { type: 'sbComponent', props: { kind: 'text', title: 'Step 1', adaptComponent: 'text', data: JSON.stringify({ description: 'Tilt the head back.' }) } },
      ];
      convert.blocksToDocx(blocks, 'Test Course', {}).then(function (buffer) {
        convert.wordToBlocks(buffer, { sourceFileName: 'roundtrip.docx' }).then(function (result) {
          var normalized = result.normalizedDocument;
          normalized.metadata.documentTitle.should.equal('Test Course');
          normalized.sections.length.should.equal(1);
          normalized.sections[0].title.should.equal('Head-tilt and chin-lift');
          var titles = [];
          (function collect(sections) {
            sections.forEach(function (s) {
              titles.push(s.title);
              collect(s.children || []);
            });
          })(normalized.sections);
          titles.should.not.containEql('Introduction');
          titles.should.not.containEql('Untitled Section');
          titles.should.not.containEql('Untitled Content Group');
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('rich card round-trip via hidden markers', function () {
    var convert = require('../plugins/content/storyboard/utils/documentConvert');

    function structureBlocks() {
      return [
        { type: 'heading', props: { level: 1 }, content: 'Module' },
        { type: 'heading', props: { level: 2 }, content: 'Section' },
        { type: 'heading', props: { level: 3 }, content: 'Group' },
      ];
    }

    it('round-trips an MCQ (options, correct flags, feedback) losslessly instead of collapsing to prose', function (done) {
      var mcqData = {
        question: '',
        options: [
          { text: 'Option A', correct: true, feedback: 'Correct!' },
          { text: 'Option B', correct: false, feedback: 'Try again.' },
        ],
        feedback: { correct: 'Well done', incorrect: 'Not quite' },
      };
      var blocks = structureBlocks().concat([
        { type: 'sbAssessment', props: { kind: 'mcq', title: 'Test Question', adaptComponent: 'mcq', data: JSON.stringify(mcqData) } },
      ]);
      convert.blocksToDocx(blocks, 'Test Course', {}).then(function (buffer) {
        convert.wordToBlocks(buffer, { sourceFileName: 'mcq.docx' }).then(function (result) {
          var mcq = result.blocks.find(function (b) { return b.type === 'sbAssessment'; });
          should.exist(mcq);
          mcq.props.kind.should.equal('mcq');
          mcq.props.title.should.equal('Test Question');
          JSON.parse(mcq.props.data).should.deepEqual(mcqData);
          // No stray prose paragraphs left over from the card's human-readable rendering.
          result.blocks.filter(function (b) { return b.type === 'paragraph'; }).length.should.equal(0);
          done();
        }).catch(done);
      }).catch(done);
    });

    it('round-trips a groupedContent sbComponent card losslessly', function (done) {
      var cardData = { showTitle: true, description: '', instruction: '', items: [{ title: 'A', body: 'B' }] };
      var blocks = structureBlocks().concat([
        { type: 'sbComponent', props: { kind: 'groupedContent', title: 'My Group', adaptComponent: 'accordion', data: JSON.stringify(cardData) } },
      ]);
      convert.blocksToDocx(blocks, 'Test Course', {}).then(function (buffer) {
        convert.wordToBlocks(buffer, { sourceFileName: 'grouped.docx' }).then(function (result) {
          var card = result.blocks.find(function (b) { return b.type === 'sbComponent'; });
          should.exist(card);
          card.props.kind.should.equal('groupedContent');
          card.props.adaptComponent.should.equal('accordion');
          JSON.parse(card.props.data).items.should.deepEqual(cardData.items);
          done();
        }).catch(done);
      }).catch(done);
    });

    it('falls back to lossy prose parsing (never throws) when the markers are stripped', function (done) {
      var blocks = structureBlocks().concat([
        { type: 'sbComponent', props: { kind: 'text', title: 'Step 1', adaptComponent: 'text', data: JSON.stringify({ description: 'Tilt the head back.' }) } },
      ]);
      convert.blocksToDocx(blocks, 'Test Course', {}).then(function (buffer) {
        var mammoth = require('mammoth');
        var originalConvert = mammoth.convertToHtml;
        // Simulate the markers being stripped by re-running mammoth without
        // vanish-text support (approximated by stripping the marker text
        // directly out of the converted HTML before it reaches the sanitizer).
        mammoth.convertToHtml = function (input, options) {
          return originalConvert(input, options).then(function (r) {
            return { value: r.value.replace(/<p>SB_CARD_(BEGIN[^<]*|END)<\/p>/g, ''), messages: r.messages };
          });
        };
        convert.wordToBlocks(buffer, { sourceFileName: 'stripped.docx' }).then(function (result) {
          mammoth.convertToHtml = originalConvert;
          // No throw, and the human-readable prose still comes through as
          // plain paragraphs (degraded fidelity, not a failed import).
          result.blocks.length.should.be.above(0);
          done();
        }).catch(function (e) { mammoth.convertToHtml = originalConvert; done(e); });
      }).catch(done);
    });

    it('does not throw on a malformed marker payload, and does not drop content after it', function () {
      var docxNormalizer = require('../plugins/content/storyboard/utils/normalize/docxNormalizer');
      var html = '<h1>Title</h1><p>SB_CARD_BEGIN::{not valid json</p><p>after</p>';
      var mammoth = require('mammoth');
      var originalConvert = mammoth.convertToHtml;
      mammoth.convertToHtml = function () { return Promise.resolve({ value: html, messages: [] }); };
      return docxNormalizer.parseDocxToNormalizedDocument(Buffer.from(''), { sourceFileName: 'malformed.docx' })
        .then(function (normalized) {
          mammoth.convertToHtml = originalConvert;
          should.exist(normalized);
          // A malformed marker must not start a "swallow" region — the
          // paragraph right after it is ordinary content, not part of any
          // card, and must survive rather than being silently discarded.
          var text = JSON.stringify(normalized);
          text.indexOf('after').should.be.above(-1);
        })
        .catch(function (e) { mammoth.convertToHtml = originalConvert; throw e; });
    });
  });

  describe('paragraph conversion', function () {
    it('converts plain paragraphs to paragraph blocks', function (done) {
      buildDocx([
        new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 }),
        new Paragraph('Just a plain paragraph.'),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var paras = findBlocks(blocks, 'paragraph');
          paras.length.should.equal(1);
          paras[0].content[0].text.should.equal('Just a plain paragraph.');
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('bold and italic conversion', function () {
    it('preserves bold and italic runs', function (done) {
      buildDocx([
        new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new TextRun({ text: 'bold', bold: true }),
            new TextRun({ text: ' plain ' }),
            new TextRun({ text: 'italic', italics: true }),
          ],
        }),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var para = findBlocks(blocks, 'paragraph')[0];
          para.content[0].styles.bold.should.equal(true);
          para.content[2].styles.italic.should.equal(true);
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('link conversion', function () {
    it('preserves hyperlinks as link inline nodes', function (done) {
      buildDocx([
        new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new ExternalHyperlink({ link: 'https://example.com', children: [new TextRun('click here')] }),
          ],
        }),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var para = findBlocks(blocks, 'paragraph')[0];
          var linkNode = para.content.find(function (n) { return n.type === 'link'; });
          should.exist(linkNode);
          linkNode.href.should.equal('https://example.com');
          linkNode.content[0].text.should.equal('click here');
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('bullet-list conversion', function () {
    it('converts a bullet-list run into one groupedContent sbComponent (generation-compatible)', function (done) {
      buildDocx([
        new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: 'First', bullet: { level: 0 } }),
        new Paragraph({ text: 'Second', bullet: { level: 0 } }),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var cards = findSbComponents(blocks, 'groupedContent');
          cards.length.should.equal(1);
          cards[0].data.items.length.should.equal(2);
          cards[0].data.items[0].body.should.equal('First');
          cards[0].data.items[1].body.should.equal('Second');
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('numbered-list conversion', function () {
    it('converts a numbered-list run into one groupedContent sbComponent', function (done) {
      buildDocx(
        [
          new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'First', numbering: { reference: 'num1', level: 0 } }),
          new Paragraph({ text: 'Second', numbering: { reference: 'num1', level: 0 } }),
        ],
        {
          numbering: {
            config: [{ reference: 'num1', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }] }],
          },
        }
      ).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var cards = findSbComponents(blocks, 'groupedContent');
          cards.length.should.equal(1);
          cards[0].data.items.length.should.equal(2);
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('nested-list conversion', function () {
    it('flattens nested list items into the parent item\'s body (groupedContent has no nested-item concept)', function (done) {
      var html = '<h1>Title</h1><ul><li>Parent<ul><li>Child</li></ul></li></ul>';
      // Bypass Mammoth (docx nested-list authoring via the `docx` package is
      // non-trivial) and exercise the HTML-walking layer directly — this is
      // exactly what Mammoth's own output looks like for a nested Word list.
      var { sanitizeMammothHtml: sanitize } = require('../plugins/content/storyboard/utils/normalize/htmlSanitizer');
      var sanitized = sanitize(html);
      sanitized.should.containEql('<li>');

      var mammoth = require('mammoth');
      var originalConvert = mammoth.convertToHtml;
      mammoth.convertToHtml = function () { return Promise.resolve({ value: html, messages: [] }); };
      parseDocxToNormalizedDocument(Buffer.from(''), { sourceFileName: 'nested.docx' }).then(function (normalized) {
        mammoth.convertToHtml = originalConvert;
        var blocks = normalizedDocumentToBlockNote(normalized);
        var cards = findSbComponents(blocks, 'groupedContent');
        cards.length.should.equal(1);
        cards[0].data.items.length.should.equal(1);
        cards[0].data.items[0].body.should.equal('Parent\n  - Child');
        done();
      }).catch(function (e) { mammoth.convertToHtml = originalConvert; done(e); });
    });
  });

  describe('table conversion', function () {
    it('converts a table into a groupedContent sbComponent, one item per row', function (done) {
      buildDocx([
        new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 }),
        new Table({
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph('A1')] }), new TableCell({ children: [new Paragraph('B1')] })] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph('A2')] }), new TableCell({ children: [new Paragraph('B2')] })] }),
          ],
        }),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var cards = findSbComponents(blocks, 'groupedContent');
          cards.length.should.equal(1);
          cards[0].data.items.length.should.equal(2);
          cards[0].data.items[0].title.should.equal('A1');
          cards[0].data.items[0].body.should.equal('B1');
          cards[0].data.items[1].title.should.equal('A2');
          cards[0].data.items[1].body.should.equal('B2');
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('image conversion', function () {
    it('embeds an image as a data-URI on an image sbComponent (wired for generation)', function (done) {
      buildDocx([
        new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new ImageRun({ data: ONE_PX_PNG, type: 'png', transformation: { width: 10, height: 10 } })] }),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var cards = findSbComponents(blocks, 'image');
          cards.length.should.equal(1);
          cards[0].data.image.link.indexOf('data:image/png;base64,').should.equal(0);
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('invalid HTML sanitization', function () {
    it('strips scripts, event handlers and unsafe link/image schemes', function () {
      var dirty = '<h1>T</h1><p onclick="evil()">Hi <script>alert(1)</script>' +
        '<a href="javascript:alert(1)">bad</a> <a href="https://ok.com">good</a></p>' +
        '<img src="javascript:alert(1)"><img src="data:image/png;base64,AA==">';
      var clean = sanitizeMammothHtml(dirty);
      clean.should.not.containEql('<script');
      clean.should.not.containEql('onclick');
      clean.should.not.containEql('javascript:');
      clean.should.containEql('href="https://ok.com"');
      clean.should.containEql('data:image/png;base64,AA==');
    });

    it('drops disallowed tags entirely (e.g. iframe)', function () {
      var dirty = '<h1>T</h1><iframe src="https://evil.example"></iframe><p>ok</p>';
      var clean = sanitizeMammothHtml(dirty);
      clean.should.not.containEql('<iframe');
      clean.should.containEql('<p>ok</p>');
    });
  });

  describe('re-import metadata detection', function () {
    it('detects a valid marker embedded by export, including courseId', function (done) {
      var props = buildCustomProperties({ courseId: 'course-456', storyboardId: 'sb-123' });
      Packer.toBuffer(new Document({ customProperties: props, sections: [{ children: [new Paragraph('x')] }] }))
        .then(function (buffer) {
          var meta = readDocxMetadata(buffer);
          should.exist(meta);
          meta.courseId.should.equal('course-456');
          meta.storyboardId.should.equal('sb-123');
          meta.schemaVersion.should.equal(1);
          done();
        }).catch(done);
    });

    it('surfaces courseId/storyboardId through parseDocxToNormalizedDocument end-to-end', function (done) {
      var props = buildCustomProperties({ courseId: 'course-789', storyboardId: 'sb-999' });
      var doc = new Document({ customProperties: props, sections: [{ children: [new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 })] }] });
      Packer.toBuffer(doc).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          normalized.metadata.courseId.should.equal('course-789');
          normalized.metadata.storyboardId.should.equal('sb-999');
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('missing metadata fallback', function () {
    it('returns null (not an error) for a docx with no marker', function (done) {
      Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('x')] }] }))
        .then(function (buffer) {
          should.not.exist(readDocxMetadata(buffer));
          done();
        }).catch(done);
    });

    it('returns null for a buffer that is not a valid zip at all', function () {
      should.not.exist(readDocxMetadata(Buffer.from('not a docx')));
    });
  });

  describe('duplicate ID prevention', function () {
    it('never generates the same block id twice across a converted document', function (done) {
      buildDocx([
        new Paragraph({ text: 'Title', heading: HeadingLevel.HEADING_1 }),
        new Paragraph('One'),
        new Paragraph('Two'),
        new Paragraph('Three'),
      ]).then(function (buffer) {
        parseDocxToNormalizedDocument(buffer).then(function (normalized) {
          var blocks = normalizedDocumentToBlockNote(normalized);
          var ids = blocks.map(function (b) { return b.id; });
          var uniqueIds = Array.from(new Set(ids));
          uniqueIds.length.should.equal(ids.length);
          done();
        }).catch(done);
      }).catch(done);
    });
  });
});
