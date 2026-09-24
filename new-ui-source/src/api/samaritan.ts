// Samaritan MVP API client. Deliberately separate from api/ai.ts - that
// module (and the AiAssistant/AiAssistPopover components it powers) is the
// existing "Ask AI" surface and is not touched by this work.

import { apiClient } from "./client";

export interface ProvenanceEntry {
  sourceType: string;
  sourceRef: Record<string, string>;
  retrievedAt: string;
  retrievalMethod: string;
}

export interface SamaritanIntent {
  goal: string;
  target: { type: string; id: string | null };
  requestedChange: string;
  confidence: string;
  assumptions: string[];
}

export interface SamaritanAction {
  actionId: string;
  requestId: string;
  actionType: string;
  target: Record<string, unknown>;
  parameters: Record<string, unknown>;
  reason: string;
  provenance: ProvenanceEntry[];
  dependsOn: string[];
  risk: string;
  requiresApproval: boolean;
  expectedResult: string;
  status: string;
}

// Discriminated union on `status` - mirrors the reasoner's contract exactly.
export type ProposeResponse =
  | { requestId: string; status: "ANSWERED"; answer: { text: string; sources: string[] } }
  | { requestId: string; status: "CLARIFICATION_REQUIRED"; clarification: { question: string } }
  | { requestId: string; status: "DECLINED"; declined: { reason: string; category: string } }
  | { requestId: string; status: "PROPOSED"; actionId: string; intent: SamaritanIntent; plan: SamaritanAction; risk: string; requiresApproval: boolean }
  | { requestId: string; status: "PLAN_PROPOSED"; intent: SamaritanIntent; plan: { actions: SamaritanAction[] }; risk: string; requiresApproval: boolean }
  | { requestId: string; status: "OBJECTIVES_DRAFTED"; objectives: string[] };

export interface ApproveResponse {
  actionId: string;
  status: "executed" | "failed";
  executionResult: Record<string, unknown>;
  verificationResult: { passed: boolean; checks: Array<{ name: string; passed: boolean }> };
}

export interface ApprovePlanResponse {
  requestId: string;
  status: "completed" | "rolled_back" | "partial_failure" | "failed";
  actions: Array<{
    actionId: string;
    actionType: string;
    status: string;
    executionResult: Record<string, unknown>;
    verificationResult: { passed: boolean; checks: Array<{ name: string; passed: boolean }> };
  }>;
}

export interface CurrentSelection {
  selectedType?: "block" | "component";
  selectedId?: string;
}

// One turn of prior conversation, sent back on every /propose call so an
// ask_clarification round-trip isn't two unrelated, memory-less requests -
// see requestHandlers.js's sanitizeConversationHistory for server-side limits.
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export function proposeRequest(params: {
  courseId: string;
  message: string;
  selection?: CurrentSelection;
  componentType?: string;
  conversationHistory?: ConversationTurn[];
}): Promise<ProposeResponse> {
  return apiClient.post<ProposeResponse>("/api/samaritan/propose", {
    courseId: params.courseId,
    selectedType: params.selection?.selectedType,
    selectedId: params.selection?.selectedId,
    message: params.message,
    componentType: params.componentType,
    conversationHistory: params.conversationHistory
  });
}

export function approveAction(actionId: string, approved: boolean): Promise<ApproveResponse> {
  return apiClient.post<ApproveResponse>(`/api/samaritan/actions/${actionId}/approve`, { approved });
}

export function approvePlan(requestId: string, approved: boolean): Promise<ApprovePlanResponse> {
  return apiClient.post<ApprovePlanResponse>(`/api/samaritan/plans/${requestId}/approve`, { approved });
}
