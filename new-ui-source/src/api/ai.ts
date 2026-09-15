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

// ─── AI Tutor (Samaritan) — full feature parity with the legacy plugin ───
// The new UI targets the same server routes the legacy frontend plugin uses
// (see `frontend/src/plugins/ai-tutor` + `plugins/services/ai-tutor/routes`),
// so both authoring surfaces share one Samaritan brain: same prompts, same
// retrieval, same citation badges, same "new chat" history reset.

export interface CitationBadge {
  label: string;
  href?: string;
}

// The route/context object the server expects. `route` is used server-side to
// bias grounding (e.g. dashboard queries hit live course data — see
// `isDashboardContext` in requestHandlers.js). All fields are optional.
export interface AiTutorContext {
  route?: string;
  courseName?: string;
  courseId?: string;
  pageId?: string;
  articleId?: string;
  blockId?: string;
  componentId?: string;
  [key: string]: unknown;
}

export interface AiTutorChatResponse {
  reply: string;
  // Always empty here — the storyboard AI proxy (see below) doesn't supply
  // citations. Kept on the response shape so the widget's rendering code
  // doesn't need to change if a citation-capable backend is added later.
  citationBadges: CitationBadge[];
}

// NOTE: the full-parity "AI Tutor" server (routes under /api/ai-tutor/*,
// `plugins/services/ai-tutor` + the legacy `frontend/src/plugins/ai-tutor`)
// is not part of this deployment — it isn't registered by any plugin in this
// repo/branch, so every call against it 404s. The only AI route actually
// registered here is the storyboard proxy this file already talks to
// (`plugins/content/storyboard/routes/index.js`, POST /api/storyboard/ai
// → handleAi). Route the widget through that instead of a service that isn't
// deployed.
export async function aiTutorChat(
  message: string,
  context?: AiTutorContext
): Promise<AiTutorChatResponse> {
  const reply = await storyboardAi("suggest", message, context ? JSON.stringify(context) : undefined);
  return { reply, citationBadges: [] };
}

// The storyboard AI proxy is stateless — it has no server-side conversation
// memory to clear, so there is nothing to fail here (previously this called
// a non-existent /api/ai-tutor/history/clear and swallowed the resulting
// 404, which let the widget claim "Conversation cleared" while the
// (nonexistent) server session was untouched). "New chat" is purely a
// client-side reset; kept async for call-site compatibility.
export async function aiTutorClearHistory(): Promise<void> {}
