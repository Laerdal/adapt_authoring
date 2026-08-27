import { useId, useState } from "react";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">{children}</div>;
}

function Divider() {
  return <div className="h-px bg-[#e5e7eb]" />;
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 py-1 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-[#d1d5db] accent-[#2d6fa8] cursor-pointer"
      />
      <span className="text-sm text-[#374151] leading-snug group-hover:text-[#111827] transition-colors">{label}</span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#6b7280]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6fa8] ${
        checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "bg-[#e5e7eb] border-[#e5e7eb]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
      <span className="text-sm font-semibold text-[var(--life-base-black)] leading-snug">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </label>
  );
}

function UploadCloudIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function AssetPicker({ label }: { label: string }) {
  const libraryId = useId();
  const urlId = useId();
  const [tab, setTab] = useState<"library" | "url">("library");
  const [url, setUrl] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <div className="inline-flex self-start overflow-hidden rounded-lg border border-[#d1d5db] bg-white">
        <button
          type="button"
          onClick={() => setTab("library")}
          className={`px-4 py-2 text-[13px] font-semibold transition-colors ${
            tab === "library" ? "bg-[#2d6fa8] text-white" : "bg-white text-[#374151] hover:bg-[#f8fafc]"
          }`}
          aria-pressed={tab === "library"}
        >
          From Asset Library
        </button>
        <button
          type="button"
          onClick={() => setTab("url")}
          className={`border-l border-[#d1d5db] px-4 py-2 text-[13px] font-semibold transition-colors ${
            tab === "url" ? "bg-[#2d6fa8] text-white" : "bg-white text-[#374151] hover:bg-[#f8fafc]"
          }`}
          aria-pressed={tab === "url"}
        >
          From URL
        </button>
      </div>

      {tab === "library" ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5">
          <span className="text-[#9ca3af] shrink-0">
            <ImageIcon />
          </span>
          <span className="flex-1 text-[13px] text-[#9ca3af]">No asset selected</span>
          <button
            id={libraryId}
            type="button"
            className="rounded-md border border-[#d1d5db] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#374151] transition-colors hover:bg-[#f3f4f6]"
          >
            Browse
          </button>
        </div>
      ) : (
        <label htmlFor={urlId} className="sr-only">{label} URL</label>
      )}

      {tab === "url" && (
        <input
          id={urlId}
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/image.png"
          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
        />
      )}
    </div>
  );
}

export default function ExportPdfPage({ courseTitle }: { courseTitle?: string }) {
  const [pdfExportEnabled, setPdfExportEnabled] = useState(false);
  const [tocPageTitles, setTocPageTitles] = useState(true);
  const [tocArticleTitles, setTocArticleTitles] = useState(true);
  const [tocBlockTitles, setTocBlockTitles] = useState(false);
  const [tocComponentTitles, setTocComponentTitles] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfAuthor, setPdfAuthor] = useState("");
  const [pdfSubject, setPdfSubject] = useState("");
  const [pdfCopyright, setPdfCopyright] = useState("");
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [addWatermark, setAddWatermark] = useState(false);

  return (
    <div className="flex w-full max-w-[672px] flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-[20px] font-bold text-[#111827]">Export as PDF</h1>
      </div>

      <section className="flex flex-col gap-3.5">
        <SectionTitle>PDF Export</SectionTitle>
        <ToggleRow label="Enable PDF Export" checked={pdfExportEnabled} onChange={setPdfExportEnabled} />
      </section>

      {pdfExportEnabled && (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3.5">
          <SectionTitle>Cover Page</SectionTitle>
          <AssetPicker label="Cover Page Image" />
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Table of Contents</SectionTitle>
          <div className="flex flex-col gap-1.5">
            <CheckboxRow label="Include Page Titles in TOC" checked={tocPageTitles} onChange={setTocPageTitles} />
            <CheckboxRow label="Include Article Titles in TOC" checked={tocArticleTitles} onChange={setTocArticleTitles} />
            <CheckboxRow label="Include Block Titles in TOC" checked={tocBlockTitles} onChange={setTocBlockTitles} />
            <CheckboxRow label="Include Component Titles in TOC" checked={tocComponentTitles} onChange={setTocComponentTitles} />
          </div>
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Document Metadata</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="PDF Title"
              value={pdfTitle}
              onChange={setPdfTitle}
              placeholder={courseTitle ? `e.g. ${courseTitle}` : "e.g. Introduction to Digital Marketing"}
            />
            <TextField
              label="PDF Author"
              value={pdfAuthor}
              onChange={setPdfAuthor}
              placeholder="e.g. Laerdal Medical"
            />
            <TextField
              label="PDF Subject"
              value={pdfSubject}
              onChange={setPdfSubject}
              placeholder="e.g. Healthcare Training"
            />
            <TextField
              label="PDF Copyright"
              value={pdfCopyright}
              onChange={setPdfCopyright}
              placeholder="e.g. © 2026 Laerdal Medical"
            />
          </div>
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Footer</SectionTitle>
          <AssetPicker label="PDF Footer Logo" />
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Password Protection</SectionTitle>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Toggle checked={passwordEnabled} onChange={setPasswordEnabled} />
              <span className="text-sm text-[#374151]">Enable Password Protection</span>
            </label>
            {passwordEnabled && (
              <div className="max-w-[320px] border-l-2 border-[#e5e7eb] pl-4">
                <TextField
                  label="PDF Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter password"
                />
              </div>
            )}
          </div>
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Watermark</SectionTitle>
          <CheckboxRow label="Add Watermark" checked={addWatermark} onChange={setAddWatermark} />
        </section>

        <Divider />

        <div>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2d6fa8] px-6 text-sm font-bold text-white transition-colors hover:bg-[#245c8f]"
          >
            <DownloadIcon />
            Export as PDF
          </button>
        </div>
      </div>
      )}
    </div>
  );
}