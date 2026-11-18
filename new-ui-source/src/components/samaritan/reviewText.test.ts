import { describe, expect, it } from "vitest";
import type { SamaritanAction } from "@/api/samaritan";
import { actionKindLabel, describeAction, riskHeadline, riskMeaning, statusLabel, summarizePlan } from "./reviewText";
import { friendlyError, friendlyFileError } from "./friendlyError";

const action = (actionType: string, parameters: Record<string, unknown> = {}): SamaritanAction => ({
  actionId: actionType,
  requestId: "r",
  actionType,
  target: {},
  parameters,
  reason: "",
  provenance: [],
  dependsOn: [],
  risk: "MEDIUM",
  requiresApproval: true,
  expectedResult: "",
  status: "awaiting_approval"
});

describe("review wording", () => {
  it("uses the Studio names, never page / article / block or raw action types", () => {
    expect(describeAction(action("CREATE_PAGE", { title: "Basics" }))).toBe("Add the topic “Basics”");
    expect(describeAction(action("CREATE_ARTICLE", { title: "Why" }))).toBe("Add the section “Why”");
    expect(describeAction(action("CREATE_BLOCK", { title: "Intro" }))).toBe("Add the content group “Intro”");
    const mcq = describeAction(action("ADD_COMPONENT", { _component: "mcq", title: "Check" }));
    expect(mcq).toBe("Add a multiple-choice question component “Check”");
    for (const t of ["CREATE_BLOCK", "ADD_COMPONENT", "CREATE_PAGE", "CREATE_ARTICLE"]) {
      expect(describeAction(action(t, { _component: "text", title: "x" }))).not.toMatch(/CREATE_|ADD_|\bpage\b|\barticle\b|\bblock\b/);
    }
  });

  it("falls back to the action's own reason, not its type, for an unknown action", () => {
    const a = { ...action("SOMETHING_NEW"), reason: "Tidy up the intro" };
    expect(describeAction(a)).toBe("Tidy up the intro");
  });

  it("summarises a plan in numbers", () => {
    const plan = [
      action("CREATE_PAGE"), action("CREATE_ARTICLE"), action("CREATE_ARTICLE"),
      action("CREATE_BLOCK"), action("CREATE_BLOCK"), action("ADD_COMPONENT"), action("ADD_COMPONENT"), action("ADD_COMPONENT")
    ];
    expect(summarizePlan(plan)).toBe("Approving will add 1 topic, 2 sections, 2 content groups and 3 components.");
    expect(summarizePlan([action("REWRITE_CONTENT")])).toBe("Approving will rewrite 1 existing component.");
  });

  it("explains what a risk rating means", () => {
    expect(riskHeadline("HIGH")).toBe("High risk");
    expect(riskMeaning("HIGH")).toMatch(/read it through before approving/);
    expect(riskHeadline("MEDIUM")).toBe("Medium risk");
  });

  it("words results and kinds for authors", () => {
    expect(actionKindLabel("CREATE_BLOCK")).toBe("Content group");
    expect(statusLabel("executed")).toBe("done");
    expect(statusLabel("rolled_back")).toBe("undone");
  });
});

describe("friendly errors", () => {
  it("hides internals and URLs", () => {
    expect(friendlyError(new Error("Unexpected token < in JSON at position 0"))).toBe("Something went wrong. Please try again.");
    expect(friendlyError(new Error("see https://example.com/stack"))).not.toMatch(/http/);
  });

  it("words the common failures", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toMatch(/connection/);
    expect(friendlyError(Object.assign(new Error("x"), { status: 403 }))).toMatch(/permission/);
    expect(friendlyError(Object.assign(new Error("x"), { status: 409 }))).toMatch(/already been processed/);
    expect(friendlyError(Object.assign(new Error("x"), { status: 429 }))).toMatch(/busy/);
    expect(friendlyError(Object.assign(new Error("x"), { status: 503 }))).toMatch(/server/);
    expect(friendlyError(new Error("Samaritan AI is unavailable"))).toMatch(/isn't available/);
  });

  it("passes a clean, short message through", () => {
    expect(friendlyError(new Error("That course no longer exists."))).toBe("That course no longer exists.");
  });

  it("words a file that cannot be read for its kind", () => {
    expect(friendlyFileError(new Error("Can't find end of central directory"), "Word")).toMatch(/This Word file couldn't be opened/);
    expect(friendlyFileError(new Error("The uploaded file is empty."), "PDF")).toBe("This PDF file is empty.");
  });
});
