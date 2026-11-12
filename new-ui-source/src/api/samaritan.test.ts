// Logic-level test of the Samaritan API request/response wiring. There is no
// jsdom/testing-library in this project (vitest.config.ts targets plain
// src/**/*.test.ts under environment:'node'), so this does not render the
// Samaritan workspace component - it verifies the request shapes it depends
// on. A real browser click-through still needs a manual pass.
import { describe, it, expect, vi, afterEach } from "vitest";
import { proposeRequest, approveAction, approvePlan } from "./samaritan";

describe("samaritan api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proposeRequest posts the expected shape for a block selection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requestId: "r1",
        status: "PROPOSED",
        actionId: "a1",
        intent: { goal: "g", target: { type: "block", id: "block-1" }, requestedChange: "x", confidence: "high", assumptions: [] },
        plan: {},
        risk: "MEDIUM",
        requiresApproval: true
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await proposeRequest({
      courseId: "course-1",
      message: "Add a Text component here.",
      selection: { selectedType: "block", selectedId: "block-1" }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/samaritan/propose");
    expect(JSON.parse(options.body)).toEqual({
      courseId: "course-1",
      selectedType: "block",
      selectedId: "block-1",
      message: "Add a Text component here.",
      componentType: undefined
    });
    expect(result.status).toBe("PROPOSED");
    if (result.status === "PROPOSED") {
      expect(result.actionId).toBe("a1");
    }
  });

  it("proposeRequest omits selection fields for a course-level (no selection) request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ requestId: "r1", status: "ANSWERED", answer: { text: "x", sources: [] } }) });
    vi.stubGlobal("fetch", fetchMock);

    await proposeRequest({ courseId: "course-1", message: "What is in this course?" });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.selectedType).toBeUndefined();
    expect(body.selectedId).toBeUndefined();
  });

  it("proposeRequest surfaces a PLAN_PROPOSED response with a multi-action plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requestId: "r1",
        status: "PLAN_PROPOSED",
        intent: { goal: "Create a CPR course", target: { type: "course", id: null }, requestedChange: "x", confidence: "high", assumptions: ["No reference docs linked."] },
        plan: { actions: [{ actionId: "a1", actionType: "CREATE_COURSE" }, { actionId: "a2", actionType: "CREATE_ARTICLE" }] },
        risk: "HIGH",
        requiresApproval: true
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await proposeRequest({ courseId: "course-1", message: "Create a CPR course." });

    expect(result.status).toBe("PLAN_PROPOSED");
    if (result.status === "PLAN_PROPOSED") {
      expect(result.plan.actions).toHaveLength(2);
      expect(result.intent.assumptions).toContain("No reference docs linked.");
    }
  });

  it("approveAction posts {approved} to the per-action approve endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ actionId: "a1", status: "executed", executionResult: {}, verificationResult: { passed: true, checks: [] } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await approveAction("a1", true);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/samaritan/actions/a1/approve");
    expect(JSON.parse(options.body)).toEqual({ approved: true });
  });

  it("approvePlan posts {approved} to the per-plan approve endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ requestId: "r1", status: "completed", actions: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await approvePlan("r1", true);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/samaritan/plans/r1/approve");
    expect(JSON.parse(options.body)).toEqual({ approved: true });
  });
});
