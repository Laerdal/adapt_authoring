import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCourseStoryboardBlocks = vi.fn();
const mockSaveStoryboardToCourse = vi.fn();

vi.mock('./adaptAuthoring', async () => {
  const actual = await vi.importActual<typeof import('./adaptAuthoring')>('./adaptAuthoring');
  return {
    ...actual,
    getCourseStoryboardBlocks: (...args: unknown[]) => mockGetCourseStoryboardBlocks(...args),
    saveStoryboardToCourse: (...args: unknown[]) => mockSaveStoryboardToCourse(...args),
  };
});

import { applyContentOnlyImport } from './storyboardContentUpdate';

function heading(id: string, level: number, content: string) {
  return { id, type: 'heading', props: { level }, content };
}
function paragraph(id: string, content: string) {
  return { id, type: 'paragraph', content };
}
function sbComponent(id: string, kind: string, title: string, data: Record<string, unknown>) {
  return { id, type: 'sbComponent', props: { kind, title, adaptComponent: kind, data: JSON.stringify(data) } };
}
function sbAssessment(id: string, kind: string, title: string, data: Record<string, unknown>) {
  return { id, type: 'sbAssessment', props: { kind, title, adaptComponent: kind, data: JSON.stringify(data) } };
}

const existingBlocks = [
  heading('topic-1', 1, 'Old Topic'),
  heading('section-1', 2, 'Old Section'),
  heading('group-1', 3, 'Old Group'),
  heading('comp-text-1', 4, 'Old Text Title'),
  paragraph('comp-text-1::body', 'Old body text'),
  sbComponent('comp-grouped-1', 'groupedContent', 'Old Grouped', { items: [{ title: 'A', body: 'B' }] }),
];

beforeEach(() => {
  mockGetCourseStoryboardBlocks.mockReset();
  mockSaveStoryboardToCourse.mockReset();
});

describe('applyContentOnlyImport', () => {
  it('patches matched topic/section/group titles and component content by position, never creating/deleting', async () => {
    mockGetCourseStoryboardBlocks.mockResolvedValue(existingBlocks);
    mockSaveStoryboardToCourse.mockResolvedValue({ updatedTitles: 4, updatedBodies: 2, unmapped: 0 });

    const importedBlocks = [
      heading('x1', 1, 'New Topic'),
      heading('x2', 2, 'New Section'),
      heading('x3', 3, 'New Group'),
      heading('x4', 4, 'New Text Title'),
      paragraph('x5', 'New body text'),
      sbComponent('x6', 'groupedContent', 'New Grouped', { items: [{ title: 'C', body: 'D' }] }),
      // Extra component with no existing counterpart at this position.
      sbComponent('x7', 'image', 'Extra Image', { image: { link: 'data:image/png;base64,AA==' } }),
    ];

    const result = await applyContentOnlyImport('course-1', importedBlocks);

    expect(mockGetCourseStoryboardBlocks).toHaveBeenCalledWith('course-1');
    const [calledCourseId, patchDoc] = mockSaveStoryboardToCourse.mock.calls[0];
    expect(calledCourseId).toBe('course-1');

    const byId = (id: string) => (patchDoc as Array<{ id: string }>).find((b) => b.id === id);

    expect(byId('topic-1')).toMatchObject({ type: 'heading', content: 'New Topic' });
    expect(byId('section-1')).toMatchObject({ type: 'heading', content: 'New Section' });
    expect(byId('group-1')).toMatchObject({ type: 'heading', content: 'New Group' });
    expect(byId('comp-text-1')).toMatchObject({ type: 'heading', content: 'New Text Title' });
    expect(byId('comp-text-1::body')).toMatchObject({ type: 'paragraph', content: 'New body text' });

    const groupedPatch = byId('comp-grouped-1') as unknown as { props: { kind: string; data: string } };
    expect(groupedPatch.props.kind).toBe('groupedContent');
    expect(JSON.parse(groupedPatch.props.data).items).toEqual([{ title: 'C', body: 'D' }]);

    // The extra image component has no existing counterpart — never created.
    expect(patchDoc).not.toEqual(expect.arrayContaining([expect.objectContaining({ props: expect.objectContaining({ kind: 'image' }) })]));
    expect(result.unmatchedCounts.components).toBe(1);
    expect(result.unmatchedCounts.topics).toBe(0);
    expect(result.updatedTitles).toBe(4);
  });

  it('degrades mismatched-kind content to a title-only update, never changing the existing component type', async () => {
    mockGetCourseStoryboardBlocks.mockResolvedValue(existingBlocks);
    mockSaveStoryboardToCourse.mockResolvedValue({ updatedTitles: 0, updatedBodies: 0, unmapped: 0 });

    const importedBlocks = [
      heading('x1', 1, 'Old Topic'),
      heading('x2', 2, 'Old Section'),
      heading('x3', 3, 'Old Group'),
      heading('x4', 4, 'Old Text Title'),
      paragraph('x5', 'Old body text'),
      // Imported content for this position is an image, but the existing
      // component is groupedContent — must not swap the component's type.
      sbComponent('x6', 'image', 'Renamed Grouped', { image: { link: 'data:image/png;base64,AA==' } }),
    ];

    await applyContentOnlyImport('course-1', importedBlocks);

    const [, patchDoc] = mockSaveStoryboardToCourse.mock.calls[0];
    const byId = (id: string) => (patchDoc as Array<{ id: string; props?: Record<string, unknown> }>).find((b) => b.id === id);
    const groupedPatch = byId('comp-grouped-1');
    expect(groupedPatch).toMatchObject({ type: 'heading', content: 'Renamed Grouped', props: { level: 4 } });
  });

  it('flattens any imported kind into a Text component\'s body when the existing component is Text', async () => {
    mockGetCourseStoryboardBlocks.mockResolvedValue(existingBlocks);
    mockSaveStoryboardToCourse.mockResolvedValue({ updatedTitles: 0, updatedBodies: 0, unmapped: 0 });

    const importedBlocks = [
      heading('x1', 1, 'Old Topic'),
      heading('x2', 2, 'Old Section'),
      heading('x3', 3, 'Old Group'),
      // Imported content for the Text slot is actually a groupedContent card.
      sbComponent('x4', 'groupedContent', 'Ignored', { items: [{ title: 'Foo', body: 'Bar' }] }),
    ];

    await applyContentOnlyImport('course-1', importedBlocks);

    const [, patchDoc] = mockSaveStoryboardToCourse.mock.calls[0];
    const body = (patchDoc as Array<{ id: string; content?: string }>).find((b) => b.id === 'comp-text-1::body');
    expect(body?.content).toBe('Foo: Bar');
  });

  it('leaves excess existing content completely untouched when the import has fewer items', async () => {
    mockGetCourseStoryboardBlocks.mockResolvedValue(existingBlocks);
    mockSaveStoryboardToCourse.mockResolvedValue({ updatedTitles: 1, updatedBodies: 0, unmapped: 0 });

    // Imported file only has a topic + section — no group/components at all.
    const importedBlocks = [heading('x1', 1, 'New Topic'), heading('x2', 2, 'Old Section')];

    await applyContentOnlyImport('course-1', importedBlocks);

    const [, patchDoc] = mockSaveStoryboardToCourse.mock.calls[0];
    const ids = (patchDoc as Array<{ id: string }>).map((b) => b.id);
    // Only the topic title changed — the existing group/components are
    // never referenced in the patch doc at all (nothing to say about them).
    expect(ids).toEqual(['topic-1']);
    expect(ids).not.toContain('group-1');
    expect(ids).not.toContain('comp-text-1');
    expect(ids).not.toContain('comp-grouped-1');
  });

  it('does not create anything for an imported topic with no existing counterpart', async () => {
    mockGetCourseStoryboardBlocks.mockResolvedValue(existingBlocks);
    mockSaveStoryboardToCourse.mockResolvedValue({ updatedTitles: 0, updatedBodies: 0, unmapped: 0 });

    const importedBlocks = [
      heading('x1', 1, 'Old Topic'),
      heading('x2', 1, 'Second Topic — brand new'),
      heading('x3', 2, 'New Section Under Second Topic'),
    ];

    const result = await applyContentOnlyImport('course-1', importedBlocks);

    const [, patchDoc] = mockSaveStoryboardToCourse.mock.calls[0];
    expect(patchDoc).toEqual([]); // nothing matched the first topic (same title), second topic has no existing counterpart
    expect(result.unmatchedCounts.topics).toBe(1);
    expect(result.unmatchedCounts.sections).toBe(1);
  });

  it('patches an existing MCQ\'s real question data (options/correct-flags/feedback), not just its title', async () => {
    const existingWithMcq = [
      heading('topic-1', 1, 'Old Topic'),
      heading('section-1', 2, 'Old Section'),
      heading('group-1', 3, 'Old Group'),
      sbAssessment('comp-mcq-1', 'mcq', 'Old Question', {
        question: '',
        options: [{ text: 'Old A', correct: true }],
      }),
    ];
    mockGetCourseStoryboardBlocks.mockResolvedValue(existingWithMcq);
    mockSaveStoryboardToCourse.mockResolvedValue({ updatedTitles: 0, updatedBodies: 0, unmapped: 0 });

    const newMcqData = {
      question: '',
      options: [
        { text: 'New A', correct: false },
        { text: 'New B', correct: true, feedback: 'Nicely done' },
      ],
      feedback: { correct: 'Great job' },
    };
    const importedBlocks = [
      heading('x1', 1, 'Old Topic'),
      heading('x2', 2, 'Old Section'),
      heading('x3', 3, 'Old Group'),
      sbAssessment('x4', 'mcq', 'New Question', newMcqData),
    ];

    await applyContentOnlyImport('course-1', importedBlocks);

    const [, patchDoc] = mockSaveStoryboardToCourse.mock.calls[0];
    const mcqPatch = (patchDoc as Array<{ id: string; type: string; props?: Record<string, unknown> }>)
      .find((b) => b.id === 'comp-mcq-1');
    expect(mcqPatch?.type).toBe('sbAssessment');
    expect(mcqPatch?.props?.title).toBe('New Question');
    expect(JSON.parse(mcqPatch?.props?.data as string)).toEqual(newMcqData);
  });
});
