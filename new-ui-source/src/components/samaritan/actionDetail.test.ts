import { describe, expect, it } from "vitest";
import { actionDetail, htmlToText } from "./actionDetail";
import type { SamaritanAction } from "@/api/samaritan";

const action = (actionType: string, parameters: Record<string, unknown>) =>
  ({ actionId: "a", actionType, parameters, target: {}, reason: "", risk: "MEDIUM", requiresApproval: true, status: "awaiting_approval" }) as unknown as SamaritanAction;

describe("actionDetail", () => {
  it("turns HTML into readable text with paragraphs and list items", () => {
    expect(htmlToText("<p>One &amp; two</p><ul><li>a</li><li>b</li></ul>")).toBe("One & two\n- a\n- b");
  });

  it("shows the complete replacement text of a rewrite", () => {
    const text = actionDetail(action("REWRITE_CONTENT", { content: "<p>The whole new text.</p>" }));
    expect(text).toBe("The whole new text.");
  });

  it("shows a component's text and a question with its options, marking the correct one", () => {
    const text = actionDetail(
      action("ADD_COMPONENT", {
        body: "<p>What does CPR stand for?</p>",
        displayTitle: "What does CPR stand for?",
        properties: {
          _items: [
            { text: "Cardiopulmonary resuscitation", _shouldBeSelected: true, feedback: "Correct" },
            { text: "Cardiac pressure recovery", _shouldBeSelected: false, feedback: "" }
          ]
        }
      })
    );
    expect(text).toContain("What does CPR stand for?");
    expect(text).toContain("[correct] Cardiopulmonary resuscitation (Correct)");
    expect(text).toContain("[ ] Cardiac pressure recovery");
  });

  it("has nothing to show for actions that only create structure", () => {
    expect(actionDetail(action("CREATE_BLOCK", { title: "B" }))).toBe("");
  });
});
