// Regression test for the properties-wipe fix (ADAPT-3760) in
// generateStoryboardCourse specifically (the Replace + Generate Course path)
// — see storyboardProperties.test.ts for the saveStoryboardToCourse
// (Update content only / Save) counterpart.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('./client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import { generateStoryboardCourse } from './storyboardGeneration';

const EXISTING = {
  topic: { _id: 'topic-1', _courseId: 'course-1', _type: 'page', _parentId: 'course-1', title: 'Topic', _sortOrder: 1 },
  section: { _id: 'section-1', _parentId: 'topic-1', title: 'Section', _sortOrder: 1 },
  block: { _id: 'group-1', _parentId: 'section-1', title: 'Group', _sortOrder: 1 },
  component: {
    _id: 'comp-1',
    _parentId: 'group-1',
    _component: 'graphic',
    title: 'Old Title',
    body: '',
    properties: { _extraCustomField: 'must-survive', _graphic: { large: 'old.png', small: 'old.png', alt: 'old' } },
  },
};

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/api/componenttype')) return Promise.resolve([{ _id: 'ct-1', component: 'graphic', displayName: 'Graphic' }]);
    if (url.includes('/content/contentobject')) return Promise.resolve([EXISTING.topic]);
    if (url.includes('/content/article')) return Promise.resolve([EXISTING.section]);
    if (url.includes('/content/block')) return Promise.resolve([EXISTING.block]);
    if (url.includes('/content/component')) return Promise.resolve([EXISTING.component]);
    return Promise.resolve([]);
  });
  mockPut.mockResolvedValue({ success: true });
});

describe('generateStoryboardCourse preserves unrelated existing component properties', () => {
  it('seeds the PUT body\'s properties from the live component before merging the new image field', async () => {
    const doc = [
      { id: 'topic-1', type: 'heading', props: { level: 1 }, content: 'Topic' },
      { id: 'section-1', type: 'heading', props: { level: 2 }, content: 'Section' },
      { id: 'group-1', type: 'heading', props: { level: 3 }, content: 'Group' },
      {
        id: 'comp-1',
        type: 'sbComponent',
        props: {
          kind: 'image',
          title: 'New Title',
          adaptComponent: 'graphic',
          data: JSON.stringify({ image: { link: 'new.png', alt: 'new' } }),
        },
      },
    ];

    await generateStoryboardCourse('course-1', doc, {}, { skipDeletes: true });

    const call = mockPut.mock.calls.find(([url]: [string]) => url.includes('/component/comp-1'));
    expect(call).toBeDefined();
    const [, patch] = call as [string, Record<string, unknown>];
    const properties = patch.properties as Record<string, unknown>;
    expect((properties._graphic as { large?: string }).large).toBe('new.png');
    expect(properties._extraCustomField).toBe('must-survive');
  });
});
