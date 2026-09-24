import { describe, expect, it } from "vitest";
import { getDefaultEditorCommands, resolveEditorFontSize, sanitizeEditorHtml, shouldSyncEditorHtml } from "./BasicRichTextEditor";

describe("sanitizeEditorHtml", () => {
  it("removes event handlers and unsafe javascript URLs from stored HTML", () => {
    const input = '<p onclick="alert(1)"><a href="javascript:alert(1)" title="Good">Click</a><img src="https://example.com/ok.png" onerror="alert(2)" /><strong>safe</strong></p>';

    const output = sanitizeEditorHtml(input);

    expect(output).not.toContain("onclick");
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("javascript:");
    expect(output).toContain("<a");
    expect(output).toContain("https://example.com/ok.png");
    expect(output).toContain("<strong>safe</strong>");
  });
});

describe("getDefaultEditorCommands", () => {
  it("includes the shared body-formatting and list commands used across the app", () => {
    const commands = getDefaultEditorCommands();

    expect(commands.map((command) => command.cmd)).toEqual(expect.arrayContaining([
      "bold",
      "italic",
      "underline",
      "insertUnorderedList",
      "insertOrderedList",
    ]));
  });
});

describe("BasicRichTextEditor sync helpers", () => {
  it("updates from external HTML only when the editor is not actively focused", () => {
    expect(shouldSyncEditorHtml("<p>Old content</p>", "<p>New content</p>", false)).toBe(true);
    expect(shouldSyncEditorHtml("<p>Old content</p>", "<p>New content</p>", true)).toBe(false);
    expect(shouldSyncEditorHtml("<p>Same</p>", "<p>Same</p>", false)).toBe(false);
  });

  it("keeps the configured font-size value usable for CSS styles", () => {
    expect(resolveEditorFontSize("18px")).toBe("18px");
    expect(resolveEditorFontSize(14)).toBe(14);
    expect(resolveEditorFontSize()).toBe(14);
  });
});
