// CI-safe smoke tests for the storyboard DOCX pipeline.
// These run without the legacy app bootstrap or external services.

var should = require('should');
var {
  Document, Packer, Paragraph, HeadingLevel
} = require('docx');

var { parseDocxToNormalizedDocument } = require('../plugins/content/storyboard/utils/normalize/docxNormalizer');
var { normalizedDocumentToBlockNote } = require('../plugins/content/storyboard/utils/normalize/toBlockNote');
var { sanitizeMammothHtml } = require('../plugins/content/storyboard/utils/normalize/htmlSanitizer');

function buildDocx(sectionChildren, docOptions) {
  var doc = new Document(Object.assign({ sections: [{ children: sectionChildren }] }, docOptions || {}));
  return Packer.toBuffer(doc);
}

function findBlocks(blocks, type) {
  return blocks.filter(function (b) { return b.type === type; });
}

describe('storyboard docx import smoke', function () {
  it('preserves H1-H4 and clamps H5 down to H4', function (done) {
    buildDocx([
      new Paragraph({ text: 'One', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: 'Two', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: 'Three', heading: HeadingLevel.HEADING_3 }),
      new Paragraph({ text: 'Four', heading: HeadingLevel.HEADING_4 }),
      new Paragraph({ text: 'Five', heading: HeadingLevel.HEADING_5 }),
      new Paragraph('Body text so the deepest heading is not pruned as empty.'),
    ]).then(function (buffer) {
      parseDocxToNormalizedDocument(buffer, { sourceFileName: 'smoke.docx' }).then(function (normalized) {
        var blocks = normalizedDocumentToBlockNote(normalized);
        var headings = findBlocks(blocks, 'heading');
        headings.length.should.equal(5);
        headings[0].props.level.should.equal(1);
        headings[3].props.level.should.equal(4);
        headings[4].props.level.should.equal(4);
        done();
      }).catch(done);
    }).catch(done);
  });

  it('round-trips the exported course title without inventing filler headings', function (done) {
    var convert = require('../plugins/content/storyboard/utils/documentConvert');
    var blocks = [
      { type: 'heading', props: { level: 1 }, content: 'Head-tilt and chin-lift' },
      { type: 'heading', props: { level: 2 }, content: 'Airway Management' },
      { type: 'heading', props: { level: 3 }, content: 'Procedure' },
      { type: 'sbComponent', props: { kind: 'text', title: 'Step 1', adaptComponent: 'text', data: JSON.stringify({ description: 'Tilt the head back.' }) } },
    ];

    convert.blocksToDocx(blocks, 'Test Course', {}).then(function (buffer) {
      convert.wordToBlocks(buffer, { sourceFileName: 'roundtrip-smoke.docx' }).then(function (result) {
        var normalized = result.normalizedDocument;
        normalized.metadata.documentTitle.should.equal('Test Course');
        var titles = [];

        (function collect(sections) {
          sections.forEach(function (s) {
            titles.push(s.title);
            collect(s.children || []);
          });
        })(normalized.sections);

        titles.should.not.containEql('Introduction');
        titles.should.not.containEql('New Section');
        titles.should.not.containEql('New Content');
        done();
      }).catch(done);
    }).catch(done);
  });

  it('sanitizes scripts, inline handlers and unsafe schemes', function () {
    var dirty = '<p class="sb-doc-title" onclick="evil()">Title</p><script>alert(1)</script><a href="javascript:evil()">bad</a><img src="data:text/html,evil">';
    var clean = sanitizeMammothHtml(dirty);

    clean.should.containEql('<p class="sb-doc-title">Title</p>');
    clean.should.not.containEql('onclick');
    clean.should.not.containEql('<script>');
    clean.should.not.containEql('javascript:evil()');
    clean.should.not.containEql('data:text/html');
  });
});