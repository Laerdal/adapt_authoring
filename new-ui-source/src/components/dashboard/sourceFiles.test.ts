import { beforeEach, describe, expect, it, vi } from "vitest";

// A plain function, not vi.fn(): the spy re-raises a mocked rejection as an unhandled one.
let importImpl: () => Promise<unknown> = () => Promise.resolve({ blocks: [] });
let importCalls = 0;
vi.mock("@/api/adaptAuthoring", () => ({
  importStoryboardDocument: () => {
    importCalls += 1;
    return importImpl();
  }
}));
const resolveWith = (value: unknown) => { importImpl = () => Promise.resolve(value); };
const rejectWith = (err: unknown) => { importImpl = () => Promise.reject(err); };

import {
  MAX_SOURCE_FILES,
  MAX_SOURCE_FILE_MB,
  MIN_SOURCE_CHARS,
  blocksToPlainText,
  meaningfulLength,
  readSourceFile,
  sourceKey,
  validateSourceFile
} from "./sourceMaterial";

// What the server's importer returns for a scanned (image-only) PDF: scaffold headings
// and an image, and no text at all. Taken from running pdfToBlocks on such a file.
const SCANNED_PDF_BLOCKS = [
  { id: "1", type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Introduction", styles: {} }], children: [] },
  { id: "2", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "New Section", styles: {} }], children: [] },
  { id: "3", type: "heading", props: { level: 3 }, content: [{ type: "text", text: "New Content", styles: {} }], children: [] },
  { id: "4", type: "sbComponent", props: { kind: "image", title: "" }, content: [], children: [] }
];

const file = (name: string, bytes = 1000, lastModified = 1) => {
  const f = new File(["x".repeat(Math.min(bytes, 10))], name, { lastModified });
  Object.defineProperty(f, "size", { value: bytes });
  return f;
};

describe("source files", () => {
  beforeEach(() => { importCalls = 0; importImpl = () => Promise.resolve({ blocks: [] }); });

  it("treats a scanned PDF as having no readable text (scaffold headings are not content)", () => {
    const text = blocksToPlainText(SCANNED_PDF_BLOCKS);
    expect(text).not.toContain("New Section");
    expect(meaningfulLength(text)).toBeLessThan(MIN_SOURCE_CHARS);
  });

  it("keeps real text and still ignores scaffold headings around it", () => {
    const real = "Hand hygiene is the single most effective measure to reduce infection. ".repeat(3);
    const text = blocksToPlainText([
      ...SCANNED_PDF_BLOCKS,
      { type: "paragraph", content: [{ type: "text", text: real }], children: [] }
    ]);
    expect(meaningfulLength(text)).toBeGreaterThanOrEqual(MIN_SOURCE_CHARS);
    expect(text).toContain("Hand hygiene");
    expect(text).not.toContain("New Content");
  });

  it("marks a scanned PDF as an error, with a message that names the cause", async () => {
    resolveWith({ blocks: SCANNED_PDF_BLOCKS });
    const r = await readSourceFile(file("scan.pdf"));
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/No readable text/);
    expect(r.error).toMatch(/scanned PDF/);
  });

  it("marks a readable file ready", async () => {
    resolveWith({
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Wash your hands for twenty seconds. ".repeat(6) }], children: [] }]
    });
    expect((await readSourceFile(file("guide.docx"))).status).toBe("ready");
  });

  it("allows exactly one source file", () => {
    expect(MAX_SOURCE_FILES).toBe(1);
  });

  it("reads .txt and .md in the browser, without the server import", async () => {
    const body = "Hand hygiene is the most effective way to reduce infection. ".repeat(4);
    for (const name of ["notes.txt", "notes.md"]) {
      const f = new File([body], name, { lastModified: 1 });
      const r = await readSourceFile(f);
      expect(r.status).toBe("ready");
      expect(r.text).toContain("Hand hygiene");
    }
    expect(importCalls).toBe(0);
  });

  it("explains a text file with too little content, and still rejects other types", async () => {
    expect((await readSourceFile(new File(["hi"], "tiny.txt"))).error).toMatch(/No readable text/);
    expect(validateSourceFile({ name: "a.exe", size: 10 })).toMatch(/Markdown/);
  });

  it("never shows a raw JSZip message or URL for a corrupt .docx", async () => {
    rejectWith(
      Object.assign(
        new Error(
          "The file could not be read — it may be corrupted, password-protected, or not a valid .docx file. (Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html)"
        ),
        { status: 400 }
      )
    );
    const r = await readSourceFile(file("broken.docx"));
    expect(r.status).toBe("error");
    expect(r.error).not.toMatch(/jszip|http|central directory/i);
    expect(r.error).toMatch(/damaged or password-protected/);
    expect(r.error).toMatch(/Word/);
  });

  it("words a dropped connection and a server error for the author", async () => {
    rejectWith(new TypeError("Failed to fetch"));
    expect((await readSourceFile(file("a.pdf"))).error).toMatch(/connection/);
    rejectWith(Object.assign(new Error("boom"), { status: 500 }));
    expect((await readSourceFile(file("b.pdf"))).error).toMatch(/server/i);
  });

  it("rejects the wrong type, an empty file and an oversized file before uploading", async () => {
    expect(validateSourceFile({ name: "16_program.exe", size: 10 })).toMatch(/isn't a supported file type/);
    expect(validateSourceFile({ name: "a.docx", size: 0 })).toMatch(/empty/);
    expect(validateSourceFile({ name: "big.pdf", size: (MAX_SOURCE_FILE_MB + 1) * 1024 * 1024 })).toMatch(new RegExp(`${MAX_SOURCE_FILE_MB} MB`));
    expect(validateSourceFile({ name: "ok.pptx", size: 5 * 1024 * 1024 })).toBeNull();

    const r = await readSourceFile(file("16_program.exe"));
    expect(r.status).toBe("error");
    expect(importCalls).toBe(0);
  });

  it("gives the same file the same key, so a duplicate can be spotted", () => {
    expect(sourceKey(file("Guide.DOCX", 500, 7))).toBe(sourceKey(file("guide.docx", 500, 7)));
    expect(sourceKey(file("guide.docx", 500, 7))).not.toBe(sourceKey(file("guide.docx", 501, 7)));
  });
});
