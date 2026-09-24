var should = require('should');

var migration = require('../plugins/services/samaritan/actions/migrations/textToNarrative');

describe('samaritan textToNarrative migration', function() {
  it('should reject any source type other than text', function() {
    var result = migration.planTextToNarrative({ _component: 'graphic', title: 't', body: 'b' });
    result.ok.should.equal(false);
  });

  it('should preserve title/displayTitle and transform body into the first narrative item', function() {
    var result = migration.planTextToNarrative({ _component: 'text', title: 'My Title', displayTitle: 'Display', body: 'Body text' });
    result.ok.should.equal(true);
    result.preserved.should.containEql('title');
    result.preserved.should.containEql('displayTitle');
    result.transformed[0].sourceField.should.equal('body');
    result.targetData.properties._items[0].body.should.equal('Body text');
    result.targetData.properties._items[0].title.should.equal('My Title');
  });

  it('should discard nothing for a plain text -> narrative migration', function() {
    var result = migration.planTextToNarrative({ _component: 'text', title: 't', body: 'b' });
    result.discarded.should.eql([]);
  });

  it('should preserve properties.instruction when present', function() {
    var result = migration.planTextToNarrative({ _component: 'text', title: 't', body: 'b', properties: { instruction: 'Read this.' } });
    result.preserved.should.containEql('properties.instruction');
    result.targetData.properties.instruction.should.equal('Read this.');
  });

  it('isSupportedPair should only allow text -> narrative', function() {
    migration.isSupportedPair('text', 'narrative').should.equal(true);
    migration.isSupportedPair('mcq', 'narrative').should.equal(false);
    migration.isSupportedPair('text', 'laerdal-narrative').should.equal(false);
  });
});
