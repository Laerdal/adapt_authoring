// Broadcasts "is this card read-only" (a review-only Share-for-Review
// invitee) down to card-internal fields that a wrapping <fieldset disabled>
// can't reach — specifically BasicRichTextEditor's contentEditable surface,
// which isn't a native form control and so doesn't respect <fieldset disabled>.
// Defaults to false so every other BasicRichTextEditor consumer (SetupPage,
// courseOverviewPage) outside a storyboard card is unaffected.
import { createContext, useContext } from 'react';

export const StoryboardReadOnlyContext = createContext(false);

export function useStoryboardReadOnly(): boolean {
  return useContext(StoryboardReadOnlyContext);
}
