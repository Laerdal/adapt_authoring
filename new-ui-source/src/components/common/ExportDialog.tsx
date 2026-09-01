// Shared "Export" dialog — course source / PDF export options. Originally
// local to SetupPage.tsx; extracted so the Preview page's "Export ▾" button
// can reuse the exact same UI instead of duplicating it. Fully self-contained
// (no dependency on courseId/course data) — still a UI-only stub today (no
// backend wiring for source/PDF export exists yet).
import { useEffect, useState } from "react";

function AssetOrUrlPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState<"asset" | "url">("asset");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <div className="flex border border-[#e5e7eb] rounded-lg overflow-hidden w-fit">
        {(["asset", "url"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-[#2d6fa8] text-white" : "bg-white text-[#6b7280] hover:bg-[#f3f4f6]"}`}
          >
            {t === "asset" ? "From Asset Library" : "From URL"}
          </button>
        ))}
      </div>
      {tab === "asset" ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-[#e5e7eb] rounded-lg bg-[#f9fafb] text-sm text-[#9ca3af]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {value && !value.startsWith("http") ? value : "No asset selected"}
          </div>
          <button type="button" className="px-3 py-2 text-xs font-medium text-[#2d6fa8] border border-[#2d6fa8] rounded-lg hover:bg-[#dbeeff] transition-colors">
            Browse
          </button>
        </div>
      ) : (
        <input
          type="url"
          value={value.startsWith("http") ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/image.png"
          className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] placeholder-[#9ca3af] text-[#374151]"
        />
      )}
    </div>
  );
}

function ExportCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
      <span
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "border-[#d1d5db] bg-white group-hover:border-[#2d6fa8]"}`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 6 5 9 10 3" />
          </svg>
        )}
      </span>
      <span className="text-sm text-[#374151]">{label}</span>
    </label>
  );
}

function ExportTextField({ label, placeholder, value, onChange, optional }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#374151]">
        {label}{optional && <span className="ml-1 text-[#9ca3af] font-normal">(Optional)</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] placeholder-[#9ca3af] text-[#374151]"
      />
    </div>
  );
}

function ExportSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-[#374151]">{label}</label>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] text-[#374151] bg-white"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ExportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-[#111827] border-b border-[#f3f4f6] pb-2">{title}</h3>
      {children}
    </div>
  );
}

function PdfExportForm() {
  const [coverImage, setCoverImage]               = useState("");
  const [tocPageTitles, setTocPageTitles]         = useState(true);
  const [tocArticleTitles, setTocArticleTitles]   = useState(true);
  const [tocBlockTitles, setTocBlockTitles]       = useState(false);
  const [tocComponentTitles, setTocComponentTitles] = useState(false);
  const [pdfTitle, setPdfTitle]                   = useState("");
  const [pdfAuthor, setPdfAuthor]                 = useState("");
  const [pdfSubject, setPdfSubject]               = useState("");
  const [pdfCopyright, setPdfCopyright]           = useState("");
  const [footerLogo, setFooterLogo]               = useState("");
  const [passwordEnabled, setPasswordEnabled]     = useState(false);
  const [userPassword, setUserPassword]           = useState("");
  const [ownerPassword, setOwnerPassword]         = useState("");
  const [encryptionLevel, setEncryptionLevel]     = useState("AES-128");
  const [disablePrinting, setDisablePrinting]     = useState(false);
  const [disableCopying, setDisableCopying]       = useState(false);
  const [disableAnnotations, setDisableAnnotations] = useState(false);
  const [allowWatermark, setAllowWatermark]       = useState(false);
  const [watermarkText, setWatermarkText]         = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("Center");

  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* Cover Page */}
      <ExportSection title="Cover Page">
        <AssetOrUrlPicker label="Cover Page Image" value={coverImage} onChange={setCoverImage} />
      </ExportSection>

      {/* Table of Contents */}
      <ExportSection title="Table of Contents">
        <div className="flex flex-col gap-3">
          <ExportCheckbox checked={tocPageTitles}      onChange={setTocPageTitles}      label="Include Page Titles in TOC" />
          <ExportCheckbox checked={tocArticleTitles}   onChange={setTocArticleTitles}   label="Include Article Titles in TOC" />
          <ExportCheckbox checked={tocBlockTitles}     onChange={setTocBlockTitles}     label="Include Block Titles in TOC" />
          <ExportCheckbox checked={tocComponentTitles} onChange={setTocComponentTitles} label="Include Component Titles in TOC" />
        </div>
      </ExportSection>

      {/* Document Metadata */}
      <ExportSection title="Document Metadata">
        <div className="grid grid-cols-2 gap-4">
          <ExportTextField label="PDF Title"     placeholder="e.g. Introduction to Digital Marketing" value={pdfTitle}     onChange={setPdfTitle} />
          <ExportTextField label="PDF Author"    placeholder="e.g. Laerdal Medical"                    value={pdfAuthor}   onChange={setPdfAuthor} />
          <ExportTextField label="PDF Subject"   placeholder="e.g. Healthcare Training"                value={pdfSubject}  onChange={setPdfSubject} />
          <ExportTextField label="PDF Copyright" placeholder="e.g. (©) 2026 Laerdal Medical"           value={pdfCopyright} onChange={setPdfCopyright} />
        </div>
      </ExportSection>

      {/* Footer */}
      <ExportSection title="Footer">
        <AssetOrUrlPicker label="PDF Footer Logo" value={footerLogo} onChange={setFooterLogo} />
      </ExportSection>

      {/* Password Protection */}
      <ExportSection title="Password Protection">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setPasswordEnabled((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${passwordEnabled ? "bg-[#2d6fa8]" : "bg-[#d1d5db]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${passwordEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <span className="text-sm font-medium text-[#374151]">Enable Password Protection</span>
        </label>

        {passwordEnabled && (
          <div className="flex flex-col gap-4 pl-0 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <ExportTextField label="User Password"  placeholder="Required to open PDF"  value={userPassword}  onChange={setUserPassword} />
              <ExportTextField label="Owner Password" placeholder="Required to edit PDF"  value={ownerPassword} onChange={setOwnerPassword} optional />
            </div>
            <ExportSelect label="Encryption Level" value={encryptionLevel} options={["RC4-40", "RC4-128", "AES-128", "AES-256"]} onChange={setEncryptionLevel} />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#374151]">Permissions</span>
              <div className="flex flex-col gap-3 pl-1">
                <ExportCheckbox checked={disablePrinting}    onChange={setDisablePrinting}    label="Disable Printing" />
                <ExportCheckbox checked={disableCopying}     onChange={setDisableCopying}     label="Disable Copying" />
                <ExportCheckbox checked={disableAnnotations} onChange={setDisableAnnotations} label="Disable Annotations" />
              </div>
            </div>
          </div>
        )}
      </ExportSection>

      {/* Watermark */}
      <ExportSection title="Watermark">
        <ExportCheckbox checked={allowWatermark} onChange={setAllowWatermark} label="Add Watermark" />
        {allowWatermark && (
          <div className="flex flex-col gap-4 pt-1">
            <ExportTextField label="Watermark Text" placeholder="e.g. CONFIDENTIAL" value={watermarkText} onChange={setWatermarkText} />
            <ExportSelect label="Watermark Position" value={watermarkPosition} options={["Top Left", "Top Center", "Top Right", "Center", "Bottom Left", "Bottom Center", "Bottom Right", "Diagonal"]} onChange={setWatermarkPosition} />
          </div>
        )}
      </ExportSection>

      {/* Export button */}
      <div className="pt-2 border-t border-[#f3f4f6]">
        <button
          type="button"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export as PDF
        </button>
      </div>
    </div>
  );
}

function ExportPanel() {
  const [activeExport, setActiveExport] = useState<"choose" | "source" | "pdf">("choose");

  if (activeExport === "source") {
    return (
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveExport("choose")}
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-lg font-semibold text-[#111827]">Export Source</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border border-dashed border-[#e5e7eb] rounded-xl bg-[#f9fafb]">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#e5e7eb] flex items-center justify-center shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#374151]">Export Source Files</p>
            <p className="text-xs text-[#9ca3af] mt-1 max-w-xs">Download the raw course source files for backup or import into another authoring tool.</p>
          </div>
          <button type="button" className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Source
          </button>
        </div>
      </div>
    );
  }

  if (activeExport === "pdf") {
    return (
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveExport("choose")}
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-lg font-semibold text-[#111827]">Export as PDF</h2>
        </div>
        <PdfExportForm />
      </div>
    );
  }

  /* Choose export type */
  return (
    <div className="max-w-2xl w-full flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Export</h2>
        <p className="text-sm text-[#6b7280] mt-1">Choose how you'd like to export this course.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Export Source */}
        <button
          type="button"
          onClick={() => setActiveExport("source")}
          className="flex flex-col items-start gap-4 p-5 bg-white border border-[#e5e7eb] rounded-xl hover:border-[#2d6fa8] hover:shadow-sm transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#f3f4f6] group-hover:bg-[#dbeeff] flex items-center justify-center transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2d6fa8]">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Export Source</p>
            <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">Download the raw source files for backup or migration.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-[#2d6fa8] flex items-center gap-1">
            Select
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* Export as PDF */}
        <button
          type="button"
          onClick={() => setActiveExport("pdf")}
          className="flex flex-col items-start gap-4 p-5 bg-white border border-[#e5e7eb] rounded-xl hover:border-[#2d6fa8] hover:shadow-sm transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#f3f4f6] group-hover:bg-[#dbeeff] flex items-center justify-center transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2d6fa8]">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M9 13h6M9 17h6M9 9h1" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Export as PDF</p>
            <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">Generate a styled PDF with TOC, metadata, and security options.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-[#2d6fa8] flex items-center gap-1">
            Select
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#e5e7eb] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Export dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[#111827]">Export</h3>
            <p className="text-sm text-[#6b7280] mt-0.5">Choose how you'd like to export this course.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors" aria-label="Close export dialog">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-[#f8fafc]">
          <ExportPanel />
        </div>
      </div>
    </div>
  );
}
