import { describe, expect, it } from 'vitest';
import { resolveInsertionAnchor } from './commentAnchor';

describe('resolveInsertionAnchor', () => {
  it('inserts at the end of the current structural section, not in the middle of its content', () => {
    const doc = [
      { id: 'h1', type: 'heading', props: { level: 1 }, content: [{ text: 'Topic' }] },
      { id: 'h2', type: 'heading', props: { level: 2 }, content: [{ text: 'Section' }] },
      { id: 'h3', type: 'heading', props: { level: 3 }, content: [{ text: 'Group' }] },
      { id: 'para', type: 'paragraph', content: [{ text: 'Intro' }] },
      { id: 'comp-1', type: 'sbComponent', props: { kind: 'text' }, content: [] },
      { id: 'comp-2', type: 'sbComponent', props: { kind: 'image' }, content: [] },
      { id: 'next-h2', type: 'heading', props: { level: 2 }, content: [{ text: 'Next section' }] },
    ];

    expect(resolveInsertionAnchor(doc, 'para')).toBe('comp-2');
    expect(resolveInsertionAnchor(doc, 'h3')).toBe('comp-2');
  });

  it('falls back to the last block in the document when the anchor is missing or stale', () => {
    const doc = [
      { id: 'h1', type: 'heading', props: { level: 1 }, content: [{ text: 'Topic' }] },
      { id: 'p1', type: 'paragraph', content: [{ text: 'Text' }] },
      { id: 'tail', type: 'sbComponent', props: { kind: 'text' }, content: [] },
    ];

    expect(resolveInsertionAnchor(doc, 'missing-anchor')).toBe('tail');
    expect(resolveInsertionAnchor(doc, undefined)).toBe('tail');
  });
});
