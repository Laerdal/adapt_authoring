// AI service (ADAPT-3760, AC7).
//
// The browser no longer holds any LLM key. All AI calls go through the engine's
// server-side proxy (POST /api/storyboard/ai), which talks to Azure OpenAI with
// credentials that stay on the server (see plugins/content/storyboard/utils/
// aiClient.js). VITE_ANTHROPIC_API_KEY and the direct Anthropic call have been
// removed.

import { apiClient } from "./client";

export type StoryboardAiAction = "improve" | "rewrite" | "summarize" | "suggest";

// Run an AI action on a piece of text via the server proxy. Returns the result.
export async function storyboardAi(
  action: StoryboardAiAction,
  text: string,
  context?: string
): Promise<string> {
  const res = await apiClient.post<{ text: string }>("/api/storyboard/ai", { action, text, context });
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
