// Regression tests for the properties-wipe fix (ADAPT-3760): every write-back
// path that patches an existing component's `properties` must SEED from what's
// actually on the live document before merging in new fields — otherwise the
// backend's update (a safe top-level partial merge, but `properties` is
// itself just one such field) replaces the WHOLE properties object with only
// what the storyboard's own data model knows about, silently wiping any
// "extra" property the real Adapt component schema has.

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

import { saveStoryboardToCourse } from './adaptAuthoring';

const EXISTING_COMPONENT = {
  _id: 'comp-1',
  _parentId: 'group-1',
  _component: 'graphic',
  title: 'Old Title',
  body: '',
  // A field the Storyboard's own data model has no concept of at all —
  // e.g. something set directly via the Page Editor. Must survive.
  properties: { _extraCustomField: 'must-survive', _graphic: { large: 'old.png', small: 'old.png', alt: 'old' } },
};

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/content/component')) return Promise.resolve([EXISTING_COMPONENT]);
    return Promise.resolve([]); // contentobject/article/block — none relevant to this test
  });
  mockPut.mockResolvedValue({ success: true });
});

describe('saveStoryboardToCourse preserves unrelated existing properties', () => {
  it('seeds patch.properties from the live component before merging the new image field', async () => {
    const doc = [
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

    await saveStoryboardToCourse('course-1', doc);

    expect(mockPut).toHaveBeenCalled();
    const [, patch] = mockPut.mock.calls.find(([url]) => String(url).includes('/component/comp-1')) as [string, Record<string, unknown>];
    const properties = patch.properties as Record<string, unknown>;
    // The new field made it through...
    expect((properties._graphic as { large?: string }).large).toBe('new.png');
    // ...and the pre-existing, storyboard-unrelated field was NOT wiped.
    expect(properties._extraCustomField).toBe('must-survive');
  });
});
