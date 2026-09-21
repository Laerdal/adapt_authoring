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
  citationBadges: CitationBadge[];
}

// Envelope every route in plugins/services/ai-tutor responds with (see
// utils/sendResponse.js: `sendSuccess` → `{ success, data }`, `sendError` →
// `{ success: false, error }`).
interface AiTutorEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// The full-parity "AI Tutor" service (Azure OpenAI + retrieval + citations +
// server-side conversation history — see `plugins/services/ai-tutor`) IS
// registered and running (`rest.post('/ai-tutor/chat', handleChat)` in
// `plugins/services/ai-tutor/routes/index.js`) — it's just untracked by git
// in this branch, which is not the same as "not deployed". The legacy
// authoring tool widget (`frontend/src/plugins/ai-tutor/views/chatPanelView.js`)
// already talks to it directly at POST /api/ai-tutor/chat with
// `{ message, context }` and reads `resp.data.reply` / `resp.data.citationBadges`.
// This widget must hit the same route with the same shape so both surfaces
// share one Samaritan brain — routing through the storyboard text-rewrite
// proxy instead (as a previous fix mistakenly did) skips the retrieval/
// grounding/history behind /api/ai-tutor/chat, which is why Studio's replies
// diverged from the Authoring Tool's.
export async function aiTutorChat(
  message: string,
  context?: AiTutorContext
): Promise<AiTutorChatResponse> {
  const res = await apiClient.post<AiTutorEnvelope<AiTutorChatResponse>>("/api/ai-tutor/chat", {
    message,
    context,
  });
  if (!res.success || !res.data) {
    throw new Error(res.error || "AI Tutor request failed.");
  }
  return { reply: res.data.reply ?? "", citationBadges: res.data.citationBadges ?? [] };
}

// Clears this session's server-side conversation history so the next message
// starts a fresh context (see `handleClearHistory` / `utils/sessionHistory.js`
// in plugins/services/ai-tutor) — same route the legacy widget calls.
export async function aiTutorClearHistory(): Promise<void> {
  const res = await apiClient.post<AiTutorEnvelope<unknown>>("/api/ai-tutor/history/clear");
  if (!res.success) {
    // A 200 with `{ success: false, error }` must still fail loudly — otherwise
    // the caller (and the UI) would report the conversation as cleared while
    // server-side history is untouched.
    throw new Error(res.error || "Failed to clear AI Tutor history.");
  }
}
