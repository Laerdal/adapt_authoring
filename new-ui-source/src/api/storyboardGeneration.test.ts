import { describe, it, expect } from 'vitest';
import { enforceMaxComponentsPerBlock, type GenTopic, type GenComponent, type ContentNode } from './storyboardGeneration';

function makeComponent(n: number): GenComponent {
  return { componentKey: 'text', title: `Comp ${n}`, body: '' };
}

function makeTreeWithOverflow(componentCount: number, sectionExistingId = 'section-1', groupExistingId = 'group-1'): GenTopic[] {
  return [
    {
      title: 'Topic',
      sections: [
        {
          existingId: sectionExistingId,
          title: 'Section',
          groups: [
            {
              existingId: groupExistingId,
              title: 'Group',
              components: Array.from({ length: componentCount }, (_, i) => makeComponent(i + 1)),
            },
          ],
        },
      ],
    },
  ];
}

describe('enforceMaxComponentsPerBlock', () => {
  it('leaves a group with <=1 component untouched', () => {
    const tree = makeTreeWithOverflow(1);
    enforceMaxComponentsPerBlock(tree);
    expect(tree[0].sections[0].groups.length).toBe(1);
  });

  it('splits overflow into continuation groups with no existingId when no matching prior block exists (fresh create — unchanged behavior)', () => {
    const tree = makeTreeWithOverflow(5);
    enforceMaxComponentsPerBlock(tree, []);
    const groups = tree[0].sections[0].groups;
    expect(groups.length).toBe(5); // one component per block
    expect(groups[0].existingId).toBe('group-1');
    expect(groups[1].existingId).toBeUndefined();
    expect(groups[2].existingId).toBeUndefined();
  });

  it('reuses a previous run\'s continuation block instead of creating a new one (the duplicate-block fix)', () => {
    const tree = makeTreeWithOverflow(5);
    const existingBlocks: ContentNode[] = [
      { _id: 'group-1', _parentId: 'section-1', title: 'Group', _sortOrder: 1 },
      { _id: 'continuation-A', _parentId: 'section-1', title: 'Group', _sortOrder: 2 },
      { _id: 'continuation-B', _parentId: 'section-1', title: 'Group', _sortOrder: 3 },
    ];
    enforceMaxComponentsPerBlock(tree, existingBlocks);
    const groups = tree[0].sections[0].groups;
    expect(groups.length).toBe(5);
    expect(groups[0].existingId).toBe('group-1');
    expect(groups[1].existingId).toBe('continuation-A');
    expect(groups[2].existingId).toBe('continuation-B');
  });

  it('only reuses as many continuations as exist, creating fresh ones for any additional overflow', () => {
    const tree = makeTreeWithOverflow(7); // needs 7 groups total, one component each
    const existingBlocks: ContentNode[] = [
      { _id: 'group-1', _parentId: 'section-1', title: 'Group', _sortOrder: 1 },
      { _id: 'continuation-A', _parentId: 'section-1', title: 'Group', _sortOrder: 2 },
    ];
    enforceMaxComponentsPerBlock(tree, existingBlocks);
    const groups = tree[0].sections[0].groups;
    expect(groups.length).toBe(7);
    expect(groups[1].existingId).toBe('continuation-A');
    expect(groups[2].existingId).toBeUndefined(); // no 3rd candidate available — fresh create
    expect(groups[3].existingId).toBeUndefined();
  });

  it('never matches a continuation block from a different parent section (title collision across sections)', () => {
    const tree = makeTreeWithOverflow(3);
    const existingBlocks: ContentNode[] = [
      { _id: 'group-1', _parentId: 'section-1', title: 'Group', _sortOrder: 1 },
      { _id: 'unrelated', _parentId: 'some-other-section', title: 'Group', _sortOrder: 2 },
    ];
    enforceMaxComponentsPerBlock(tree, existingBlocks);
    const groups = tree[0].sections[0].groups;
    expect(groups[1].existingId).toBeUndefined();
  });
});
