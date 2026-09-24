// Samaritan MVP workspace - a conversational panel embedded in the course
// editor. Shell (docked right-edge panel, welcome card, quick actions,
// close/reopen) follows the reference design (Adapt Studio DAMS 4.0's
// SamaritanPanel inside StoryboardPanel.tsx) reimplemented with this app's
// own design tokens - unlike DAMS's version, every action here calls the
// real Samaritan backend instead of a canned setTimeout'd reply, and
// proposals/plans render as real approve/cancel cards, not plain text.
//
// NOTE: the storyboard's existing "Samaritan Assistance" rewrite/shorten/
// lengthen popover (components/storyboard/AiAssistPopover.tsx, api/ai.ts)
// is a distinct, existing feature that shares the "Samaritan" name and is
// not touched here.
//
// Selection: the studio iframe is loaded with `embedded=1`, which disables
// the routes/studio postMessage bridge - so this reads CourseEditor's own
// already-tracked selection state (selectedBlockId/selectedComponentId) as
// props, rather than a second, non-functional selection mechanism.
// Conversation history here is client-side/session-only - no server-side
// persistent conversation history is introduced (kept separate from the
// durable action history, which lives entirely server-side).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  proposeRequest,
  approveAction,
  approvePlan,
  type ProposeResponse,
  type ApproveResponse,
  type ApprovePlanResponse,
  type SamaritanAction,
  type ConversationTurn
} from "@/api/samaritan";

interface Props {
  courseId: string;
  selectedBlockId: string | null;
  selectedComponentId: string | null;
  hasCanvasSelection: boolean;
  // Fired once on mount, opening the panel automatically (e.g. a future
  // "regenerate this page" entry point elsewhere in the editor).
  autoSendMessage?: string;
  onExecuted?: (componentId: string) => void;
  onStructureChanged?: () => void;
}

type Turn =
  | { kind: "user"; text: string }
  | { kind: "answer"; text: string; sources: string[] }
  | { kind: "clarification"; question: string }
  | { kind: "declined"; reason: string; category: string }
  | { kind: "proposal"; requestId: string; actionId: string; plan: SamaritanAction; risk: string }
  | { kind: "plan-proposal"; requestId: string; actions: SamaritanAction[]; risk: string; assumptions: string[] }
  | { kind: "result"; text: string }
  | { kind: "plan-result"; response: ApprovePlanResponse }
  | { kind: "objectives"; objectives: string[] }
  | { kind: "error"; text: string };

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: (hasSelection: boolean) => string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "review",
    label: "Review course content",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    prompt: (hasSelection) =>
      hasSelection
        ? "Review the currently selected content and summarize its state."
        : "Review the current course content and summarize its state, calling out anything incomplete or inconsistent."
  },
  {
    id: "improve",
    label: "Improve learning objectives",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    prompt: () => "Suggest learning objectives for this course based on its current content, or improvements to make the existing ones clearer."
  },
  {
    id: "regen",
    label: "Regenerate sections",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    ),
    prompt: (hasSelection) =>
      hasSelection
        ? "Rewrite the content of the selected section to improve it."
        : "Which sections of this course would most benefit from being regenerated, and why?"
  },
  {
    id: "gaps",
    label: "Identify content gaps",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
    ),
    prompt: () => "Identify any gaps in this course's content coverage."
  }
];

function currentSelection(selectedComponentId: string | null, hasCanvasSelection: boolean, selectedBlockId: string | null) {
  if (hasCanvasSelection && selectedComponentId) return { selectedType: "component" as const, selectedId: selectedComponentId };
  if (selectedBlockId) return { selectedType: "block" as const, selectedId: selectedBlockId };
  return undefined;
}

// Turned into a short assistant-role history entry so the NEXT /propose call
// (e.g. the user's answer to a clarifying question) has a record of what
// Samaritan just said - without this, each call is a stateless one-shot and
// a clarification round-trip has no memory of itself.
function summarizeForHistory(response: ProposeResponse): string {
  if (response.status === "ANSWERED") return response.answer.text;
  if (response.status === "CLARIFICATION_REQUIRED") return response.clarification.question;
  if (response.status === "DECLINED") return `Declined: ${response.declined.reason}`;
  if (response.status === "PROPOSED") return `Proposed: ${describeChanges(response.plan)} - ${response.plan.reason}`;
  if (response.status === "OBJECTIVES_DRAFTED") return `Drafted objectives: ${response.objectives.join("; ")}`;
  return `Proposed a plan of ${response.plan.actions.length} actions: ${response.plan.actions.map((a) => a.actionType).join(", ")}`;
}

function describeChanges(plan: SamaritanAction): string {
  switch (plan.actionType) {
    case "ADD_COMPONENT":
      return `Add a ${(plan.parameters as any)._component} component`;
    case "REWRITE_CONTENT":
      return "Rewrite the selected content";
    case "REMOVE_COMPONENT":
      return "Remove the selected component";
    case "REPLACE_COMPONENT":
      return `Replace with a ${(plan.parameters as any).targetComponentType} component`;
    case "ENABLE_PLUGIN":
      return "Enable plugin for this course";
    case "DISABLE_PLUGIN":
      return "Disable plugin for this course";
    default:
      return plan.actionType;
  }
}

function HeartIcon({ size = 18, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={inverted ? "white" : "none"} stroke={inverted ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function SamaritanWorkspace({
  courseId,
  selectedBlockId,
  selectedComponentId,
  hasCanvasSelection,
  autoSendMessage,
  onExecuted,
  onStructureChanged
}: Props) {
  const [open, setOpen] = useState(!!autoSendMessage);
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeGoalLabel, setActiveGoalLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoSent = useRef(false);
  const history = useRef<ConversationTurn[]>([]);

  const selection = currentSelection(selectedComponentId, hasCanvasSelection, selectedBlockId);

  useEffect(() => {
    if (autoSendMessage && !autoSent.current) {
      autoSent.current = true;
      setOpen(true);
      send(autoSendMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendMessage]);

  async function send(text: string, goalLabel?: string) {
    if (!text.trim() || busy) return;
    if (goalLabel) setActiveGoalLabel(goalLabel);
    setTurns((t) => [...t, { kind: "user", text }]);
    setMessage("");
    setBusy(true);
    try {
      const response = await proposeRequest({ courseId, message: text, selection, conversationHistory: history.current });
      history.current = [...history.current, { role: "user", content: text }, { role: "assistant", content: summarizeForHistory(response) }];
      appendResponseTurn(response);
    } catch (err) {
      setTurns((t) => [...t, { kind: "error", text: err instanceof Error ? err.message : "Failed to reach Samaritan" }]);
    } finally {
      setBusy(false);
    }
  }

  function appendResponseTurn(response: ProposeResponse) {
    if (response.status === "ANSWERED") {
      setTurns((t) => [...t, { kind: "answer", text: response.answer.text, sources: response.answer.sources }]);
    } else if (response.status === "CLARIFICATION_REQUIRED") {
      setTurns((t) => [...t, { kind: "clarification", question: response.clarification.question }]);
    } else if (response.status === "DECLINED") {
      setTurns((t) => [...t, { kind: "declined", reason: response.declined.reason, category: response.declined.category }]);
    } else if (response.status === "PROPOSED") {
      setTurns((t) => [...t, { kind: "proposal", requestId: response.requestId, actionId: response.actionId, plan: response.plan, risk: response.risk }]);
    } else if (response.status === "PLAN_PROPOSED") {
      setTurns((t) => [
        ...t,
        { kind: "plan-proposal", requestId: response.requestId, actions: response.plan.actions, risk: response.risk, assumptions: response.intent.assumptions }
      ]);
    } else if (response.status === "OBJECTIVES_DRAFTED") {
      setTurns((t) => [...t, { kind: "objectives", objectives: response.objectives }]);
    }
  }

  async function decide(actionId: string, approved: boolean) {
    setBusy(true);
    try {
      const response: ApproveResponse = await approveAction(actionId, approved);
      const passed = response.status === "executed" && response.verificationResult.passed;
      setTurns((t) => [
        ...t,
        { kind: "result", text: approved ? (passed ? `Done - verified (${response.verificationResult.checks.filter((c) => c.passed).length}/${response.verificationResult.checks.length} checks).` : `Executed but verification found issues.`) : "Cancelled." }
      ]);
      if (approved && passed) {
        const componentId = (response.executionResult as any).componentId || (response.executionResult as any).newComponentId;
        if (componentId) onExecuted?.(componentId);
        onStructureChanged?.();
      }
    } catch (err) {
      setTurns((t) => [...t, { kind: "error", text: err instanceof Error ? err.message : "Failed to execute action" }]);
    } finally {
      setBusy(false);
    }
  }

  async function decidePlan(requestId: string, approved: boolean) {
    setBusy(true);
    try {
      const response = await approvePlan(requestId, approved);
      setTurns((t) => [...t, { kind: "plan-result", response }]);
      if (response.status === "completed") onStructureChanged?.();
    } catch (err) {
      setTurns((t) => [...t, { kind: "error", text: err instanceof Error ? err.message : "Failed to execute plan" }]);
    } finally {
      setBusy(false);
    }
  }

  function resetChat() {
    setTurns([]);
    setActiveGoalLabel(null);
    history.current = [];
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(message);
    }
  }

  // Rendered via a portal straight into <body>: this panel is mounted deep
  // inside the course editor's DOM tree, and any ancestor there with a CSS
  // transform/filter/contain (common in drag-and-drop editor layouts)
  // silently turns `position: fixed` into "fixed to that ancestor" instead
  // of the viewport - which is exactly what made the panel appear to run
  // off-screen/out of frame. Portaling sidesteps that regardless of which
  // ancestor is responsible.
  if (!open) {
    return createPortal(
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Ask Samaritan"
        className="fixed bottom-4 right-4 z-[9999] w-12 h-12 rounded-full bg-[#6b4fa8] hover:bg-[#5a3f91] shadow-xl flex items-center justify-center text-white transition-colors"
      >
        <HeartIcon size={20} inverted />
      </button>,
      document.body
    );
  }

  return createPortal(
    <aside className="fixed top-0 right-0 h-full w-[340px] z-[9999] bg-white border-l border-[#e5e7eb] shadow-xl flex flex-col text-sm">
      <div className="h-12 shrink-0 flex items-center justify-between pl-4 pr-2.5 border-b border-[#e5e7eb]">
        <div className="flex items-center gap-2">
          <span className="text-[#6b4fa8]"><HeartIcon size={18} /></span>
          <span className="font-bold text-sm text-[#111827]">Ask Samaritan</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Ask Samaritan"
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {turns.length === 0 ? (
        <div className="flex-1 overflow-y-auto px-3.5 pt-5 pb-4">
          <div className="flex flex-col items-center gap-2.5 text-center bg-[#f5f0ff] rounded-xl px-4 pt-5 pb-4.5 mb-5">
            <div className="w-11 h-11 rounded-full bg-[#6b4fa8] flex items-center justify-center">
              <HeartIcon size={22} inverted />
            </div>
            <p className="font-bold text-sm text-[#111827]">Hi, I'm Samaritan</p>
            <p className="text-xs text-[#6b7280] leading-relaxed">
              Your AI course co-author. I can review content, regenerate sections, add components and fill gaps &mdash; all in context.
            </p>
          </div>

          <p className="text-xs font-bold text-[#111827] uppercase tracking-wide mb-2">What would you like to do?</p>
          <div className="flex flex-col gap-1.5 mb-4">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={() => send(action.prompt(!!selection), action.label)}
                className="flex items-center gap-2.5 px-3 py-2.5 border border-[#e5e7eb] rounded-lg text-sm text-[#374151] hover:bg-[#f9fafb] hover:border-[#c4b5f4] transition-colors disabled:opacity-40"
              >
                <span className="text-[#6b7280]">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 my-4">
            <span className="flex-1 h-px bg-[#e5e7eb]" />
            <span className="text-xs text-[#9ca3af]">or ask anything</span>
            <span className="flex-1 h-px bg-[#e5e7eb]" />
          </div>

          <div className="relative">
            <textarea
              rows={3}
              value={message}
              disabled={busy}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Samaritan anything about your course…"
              className="w-full px-3 py-2.5 pr-10 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b4fa8] focus:border-transparent resize-none"
            />
            <button
              type="button"
              onClick={() => send(message)}
              disabled={busy || !message.trim()}
              aria-label="Send"
              className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-md bg-[#6b4fa8] disabled:bg-[#d1d5db] flex items-center justify-center text-white transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          {selection && <p className="text-xs text-[#9ca3af] mt-2">Scoped to the selected {selection.selectedType}.</p>}
        </div>
      ) : (
        <>
          <div className="px-3 py-1.5 bg-[#f5f0ff] border-b border-[#e5e7eb] flex items-center gap-1.5 shrink-0">
            <span className="text-[#6b4fa8]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </span>
            <span className="text-xs text-[#4b3a7c] flex-1">{activeGoalLabel || "Conversation"}</span>
            <button type="button" onClick={resetChat} className="text-xs text-[#6b7280] hover:text-[#111827]">
              New chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {turns.map((turn, i) => (
              <div key={i}>
                {turn.kind === "user" && <p className="text-right text-blue-700">{turn.text}</p>}

                {turn.kind === "answer" && (
                  <div>
                    <p>{turn.text}</p>
                    {turn.sources.length > 0 && <p className="text-xs text-gray-500 mt-1">Sources: {turn.sources.join(", ")}</p>}
                  </div>
                )}

                {turn.kind === "clarification" && <p className="italic">Samaritan asks: {turn.question}</p>}

                {turn.kind === "declined" && (
                  <div>
                    <p>Samaritan can't do this: {turn.reason}</p>
                    {turn.category === "requires_engineering_agent" && (
                      <p className="text-xs text-amber-600 mt-1">This requires the Engineering Agent (source-code work), not course authoring.</p>
                    )}
                  </div>
                )}

                {turn.kind === "proposal" && (
                  <div className="border rounded p-2 bg-gray-50">
                    <p className="font-medium">{describeChanges(turn.plan)}</p>
                    <p className="text-xs text-gray-600 mb-2">{turn.plan.reason}</p>
                    <p className="text-xs mb-2">Risk: <strong>{turn.risk}</strong></p>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 bg-green-600 text-white rounded text-xs" disabled={busy} onClick={() => decide(turn.actionId, true)}>Approve</button>
                      <button className="px-2 py-1 bg-gray-200 rounded text-xs" disabled={busy} onClick={() => decide(turn.actionId, false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {turn.kind === "plan-proposal" && (
                  <div className="border rounded p-2 bg-gray-50">
                    <p className="font-medium">Proposed plan ({turn.actions.length} actions)</p>
                    {turn.assumptions.length > 0 && (
                      <ul className="text-xs text-amber-700 list-disc pl-4 my-1">
                        {turn.assumptions.map((a, j) => <li key={j}>{a}</li>)}
                      </ul>
                    )}
                    <ul className="text-xs my-1 max-h-40 overflow-y-auto">
                      {turn.actions.map((a) => (
                        <li key={a.actionId}>- {a.actionType}: {a.reason}</li>
                      ))}
                    </ul>
                    <p className="text-xs mb-2">Risk: <strong>{turn.risk}</strong></p>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 bg-green-600 text-white rounded text-xs" disabled={busy} onClick={() => decidePlan(turn.requestId, true)}>Approve plan</button>
                      <button className="px-2 py-1 bg-gray-200 rounded text-xs" disabled={busy} onClick={() => decidePlan(turn.requestId, false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {turn.kind === "objectives" && (
                  <div>
                    <p className="font-medium mb-1">Drafted objectives:</p>
                    <ul className="text-xs list-disc pl-4">
                      {turn.objectives.map((o, j) => <li key={j}>{o}</li>)}
                    </ul>
                  </div>
                )}

                {turn.kind === "result" && <p className="text-green-700">{turn.text}</p>}

                {turn.kind === "plan-result" && (
                  <div>
                    <p className="font-medium">Plan {turn.response.status}</p>
                    <ul className="text-xs">
                      {turn.response.actions.map((a) => (
                        <li key={a.actionId}>- {a.actionType}: {a.status}{a.verificationResult && !a.verificationResult.passed ? " (verification issues)" : ""}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {turn.kind === "error" && <p className="text-red-600">{turn.text}</p>}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-[#e5e7eb] shrink-0">
            <div className="relative">
              <textarea
                rows={2}
                value={message}
                disabled={busy}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply to Samaritan…"
                className="w-full px-3 py-2.5 pr-10 text-sm bg-[#f9fafb] border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b4fa8] focus:border-transparent resize-none"
              />
              <button
                type="button"
                onClick={() => send(message)}
                disabled={busy || !message.trim()}
                aria-label="Send"
                className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-md bg-[#6b4fa8] disabled:bg-[#d1d5db] flex items-center justify-center text-white transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-[#9ca3af] text-center mt-2">Samaritan can make mistakes. Always review AI suggestions.</p>
          </div>
        </>
      )}
    </aside>,
    document.body
  );
}
