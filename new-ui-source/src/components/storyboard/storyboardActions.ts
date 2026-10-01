// Action channel for storyboard component cards.
//
// AI and Comment are authoring ACTIONS attached to a component card, not course
// components. The cards are rendered inside BlockNote's block layer, so instead
// of threading props through that layer we use a tiny module singleton: the
// workspace registers handlers on mount and the card invokes open*() on click.
// This opens the workspace-level AI Assistance / Comment popovers.

export interface AiAssistRequest {
  /** Seed text for the popover (the card's current content). */
  initialText?: string;
  /** Apply the AI result as a NEW Text component. */
  onInsert: (text: string) => void;
  /** Apply the AI result in place (replace the card's content). */
  onReplace: (text: string) => void;
}

export interface CommentRequest {
  /** BlockNote block id the comment anchors to (never changes course structure). */
  blockId: string;
  /** Header label, e.g. "CONTENT · TEXT". */
  label: string;
}

interface Handlers {
  openAi?: (req: AiAssistRequest) => void;
  openComment?: (req: CommentRequest) => void;
}

let handlers: Handlers = {};

export const storyboardActions = {
  /** Called by the workspace on mount; returns an unregister fn. */
  register(h: Handlers): () => void {
    handlers = h;
    return () => {
      handlers = {};
    };
  },
  openAi(req: AiAssistRequest): void {
    handlers.openAi?.(req);
  },
  openComment(req: CommentRequest): void {
    handlers.openComment?.(req);
  },
};
