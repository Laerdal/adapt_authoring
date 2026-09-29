import { describe, expect, it } from 'vitest';
import { getRichTextEditableFields } from './componentBlock';

describe('getRichTextEditableFields', () => {
  it('includes the rich text content fields for text and grouped content cards', () => {
    expect(getRichTextEditableFields('text')).toContain('description');
    expect(getRichTextEditableFields('text')).toContain('instruction');

    expect(getRichTextEditableFields('groupedContent')).toContain('itemBody');
    expect(getRichTextEditableFields('groupedContent')).toContain('instruction');
  });

  it('covers assessment result text fields as rich text content', () => {
    expect(getRichTextEditableFields('assessmentResult')).toContain('completionBody');
    expect(getRichTextEditableFields('assessmentResult')).toContain('bandFeedback');
    expect(getRichTextEditableFields('assessmentResult')).toContain('instruction');
  });
});
