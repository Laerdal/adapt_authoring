// AI service (ADAPT-3760, AC7).
//
// The browser no longer holds any LLM key. All AI calls go through the engine's
// server-side proxy (POST /api/storyboard/ai), which talks to Azure OpenAI with
// credentials that stay on the server (see plugins/content/storyboard/utils/
// aiClient.js). VITE_ANTHROPIC_API_KEY and the direct Anthropic call have been
// removed.

import { apiClient } from "./client";

export type StoryboardAiAction = "improve" | "rewrite" | "summarize" | "suggest";

// Samaritan Assistance actions (parity with the legacy CKEditor tool). `custom`
// carries a free-text instruction. All share the same server proxy.
export type SamaritanAction = "improve" | "shorten" | "lengthen" | "spelling" | "custom";

// Run an AI action on a piece of text via the server proxy. Returns the result.
export async function storyboardAi(
  action: StoryboardAiAction,
  text: string,
  context?: string
): Promise<string> {
  const res = await apiClient.post<{ text: string }>("/api/storyboard/ai", { action, text, context });
  return res.text ?? "";
}

// Samaritan Assistance call: a fixed action (improve/shorten/lengthen/spelling)
// or a free-text `custom` instruction. `text` is the content to operate on (may
// be empty for generate-from-scratch). `context` is the course title. Keys stay
// server-side — same /api/storyboard/ai proxy.
export async function samaritanAssist(
  action: SamaritanAction,
  text: string,
  opts?: { instruction?: string; context?: string }
): Promise<string> {
  const res = await apiClient.post<{ text: string }>("/api/storyboard/ai", {
    action,
    text,
    instruction: opts?.instruction,
    context: opts?.context,
  });
  return res.text ?? "";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Back-compat helper for the (placeholder) AiAssistant chat widget: routes the
// latest user turn through the server proxy. No client-side key.
export async function sendMessage(opts: {
  messages: ChatMessage[];
  courseContext?: unknown;
}): Promise<{ text: string }> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
  const context = opts.courseContext ? JSON.stringify(opts.courseContext) : undefined;
  const text = await storyboardAi("suggest", lastUser?.content ?? "", context);
  return { text };
}
