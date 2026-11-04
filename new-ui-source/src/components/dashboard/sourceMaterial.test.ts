import { describe, expect, it } from "vitest";
import { blocksToPlainText, composeSourceText, formatFor, MAX_SOURCE_CHARS, type SourceFile } from "./sourceMaterial";

describe("sourceMaterial", () => {
  it("maps file extensions to the storyboard import formats", () => {
    expect(formatFor("Protocol.DOCX")).toBe("word");
    expect(formatFor("slides.pptx")).toBe("pptx");
    expect(formatFor("guide.pdf")).toBe("pdf");
    expect(formatFor("notes.txt")).toBeNull();
    expect(formatFor("noextension")).toBeNull();
  });

  it("flattens BlockNote blocks, headings, nested children and tables to plain text", () => {
    const text = blocksToPlainText([
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Airway" }] },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Open the " }, { type: "text", text: "airway." }],
        children: [{ type: "bulletListItem", content: [{ type: "text", text: "Head tilt" }] }]
      },
      { type: "table", content: { type: "tableContent", rows: [{ cells: [[{ type: "text", text: "A" }], [{ type: "text", text: "B" }]] }] } }
    ]);
    expect(text).toContain("## Airway");
    expect(text).toContain("Open the airway.");
    expect(text).toContain("Head tilt");
    expect(text).toContain("A | B");
  });

  it("reads a table-only document, including wrapped cells and multiple rows", () => {
    const text = blocksToPlainText([
      {
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            { cells: [[{ type: "text", text: "Step" }], { type: "tableCell", content: [{ type: "text", text: "Action" }] }] },
            { cells: [[{ type: "text", text: "1" }], [{ type: "text", text: "Check response" }]] }
          ]
        }
      }
    ]);
    expect(text).toBe("Step | Action\n1 | Check response");
  });

  it("shares the character budget across files and reports truncation", () => {
    const big = "x".repeat(MAX_SOURCE_CHARS);
    const files: SourceFile[] = [
      { name: "a.docx", status: "ready", text: big },
      { name: "b.pdf", status: "ready", text: "short" },
      { name: "c.pptx", status: "error", text: "", error: "bad" }
    ];
    const { text, truncated } = composeSourceText(files);
    expect(truncated).toBe(true);
    expect(text).toContain("--- a.docx ---");
    expect(text).toContain("short");
    expect(text).not.toContain("c.pptx");
    expect(text.length).toBeLessThan(MAX_SOURCE_CHARS + 200);
  });

  it("returns nothing when no file is ready", () => {
    expect(composeSourceText([{ name: "a.pdf", status: "reading", text: "" }])).toEqual({ text: "", truncated: false });
  });
});
