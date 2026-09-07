// Import preview (ADAPT-3760 storyboard import, spec "Import Preview").
// Shown after a file has been parsed + normalized server-side, before any of
// it touches the live storyboard. Nothing is applied until Confirm.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Loader2, FileText } from 'lucide-react';
import type { ImportMode, NormalizedDocument, NormalizedSection } from '@/types/storyboardImport';
import { planStoryboardGeneration, type GenerationPlan } from '@/api/storyboardGeneration';

const FIDELITY_WARNING: Record<'pdf' | 'pptx', string> = {
  pdf: 'PDF import uses best-effort content extraction. Some formatting, headings, tables, images, columns, or reading order may not be preserved.',
  pptx: 'PowerPoint import uses best-effort content extraction. Some slide layouts, positioning, graphics, animations, media, and formatting may not be preserved.',
};

function countSections(sections: NormalizedSection[]): number {
  return sections.reduce((n, s) => n + 1 + countSections(s.children || []), 0);
}

function HierarchyTree({ sections, depth = 0 }: { sections: NormalizedSection[]; depth?: number }) {
  return (
    <>
      {sections.map((s) => (
        <div key={s.id}>
          <div style={{ paddingLeft: depth * 16, fontSize: 13, color: 'var(--life-color-text-default)' }}>
            {'H'}{s.level} · {s.title || '(untitled section)'}
          </div>
          {s.children && s.children.length > 0 && <HierarchyTree sections={s.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  );
}

function contentPreviewSnippet(sections: NormalizedSection[], limit = 400): string {
  const parts: string[] = [];
  const walk = (list: NormalizedSection[]) => {
    for (const s of list) {
      if (s.title) parts.push(s.title);
      for (const b of s.blocks) {
        if ((b.kind === 'paragraph' || b.kind === 'heading') && b.inline?.length) {
          parts.push(b.inline.map((r) => r.text).join(''));
        }
      }
      if (s.children) walk(s.children);
    }
  };
  walk(sections);
  const text = parts.join(' — ');
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export default function ImportPreviewDialog({
  fileName,
  fileType,
  normalizedDocument,
  blocks,
  courseId,
  hasExistingContent,
  canUpdateContentOnly,
  courseIdMismatch,
  onConfirm,
  onClose,
}: {
  fileName: string;
  fileType: 'docx' | 'pdf' | 'pptx';
  normalizedDocument: NormalizedDocument | null;
  blocks: unknown[];
  courseId?: string;
  hasExistingContent: boolean;
  /** Only true when the file's embedded Course ID marker matches this course
   * — position-matching an unrelated document risks patching the wrong
   * components (ADAPT-3760 import enhancements). */
  canUpdateContentOnly: boolean;
  /** The file carries a Course ID marker, but for a DIFFERENT course. */
  courseIdMismatch?: boolean;
  onConfirm: (mode: ImportMode) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ImportMode>(hasExistingContent && canUpdateContentOnly ? 'reimport' : hasExistingContent ? 'append' : 'new');
  const [plan, setPlan] = useState<GenerationPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setPlanLoading(true);
    planStoryboardGeneration(courseId, blocks as unknown[], {})
      .then((p) => { if (!cancelled) setPlan(p); })
      .catch(() => { if (!cancelled) setPlan(null); })
      .finally(() => { if (!cancelled) setPlanLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, blocks]);

  const fidelity = normalizedDocument?.metadata.fidelity ?? (fileType === 'docx' ? 'high' : 'lower');
  const warnings = normalizedDocument?.metadata.warnings ?? [];
  const sectionCount = normalizedDocument ? countSections(normalizedDocument.sections) : 0;
  const title = normalizedDocument?.metadata.documentTitle || fileName;
  const snippet = useMemo(
    () => (normalizedDocument ? contentPreviewSnippet(normalizedDocument.sections) : ''),
    [normalizedDocument],
  );

  const modeOptions: { id: ImportMode; label: string; help: string; disabled?: boolean; danger?: boolean }[] = [
    { id: 'new', label: 'Create a new storyboard', help: 'Start fresh from this file.', disabled: hasExistingContent },
    { id: 'append', label: 'Append to current storyboard', help: 'Add this content after what’s already there.', disabled: !hasExistingContent },
    { id: 'replace', label: 'Replace current storyboard', help: 'Applies immediately — removes the current course content and generates the course from this file. This cannot be undone.', disabled: !hasExistingContent, danger: true },
    {
      id: 'reimport',
      label: 'Update content only',
      help: canUpdateContentOnly
        ? 'Update text/content in place, matched by position — never adds, removes, or reorders pages, sections, content groups, or components.'
        : 'Only available when this file was previously exported from this exact course (matched by its embedded Course ID).',
      disabled: !canUpdateContentOnly,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto pt-16 pb-16"
      style={{ background: 'rgba(4, 30, 41, 0.35)' }}
      onMouseDown={onClose}
    >
      <div
        className="w-[min(94vw,640px)] p-5"
        style={{
          borderRadius: 12,
          background: 'var(--life-color-bg-surface-default)',
          border: '1px solid var(--life-color-border-subtle)',
          boxShadow: 'var(--elevation-lg)',
          fontFamily: 'var(--font-family-primary)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" style={{ color: 'var(--life-color-text-subtle)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--life-color-text-default)' }}>Import Preview</span>
          <button type="button" onClick={onClose} title="Close" className="ml-auto sb-panel-collapse-btn">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1" style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--life-color-text-subtle)' }}>Source file</span>
          <span style={{ color: 'var(--life-color-text-default)' }}>{fileName}</span>
          <span style={{ color: 'var(--life-color-text-subtle)' }}>File type</span>
          <span style={{ color: 'var(--life-color-text-default)' }}>{fileType.toUpperCase()}</span>
          <span style={{ color: 'var(--life-color-text-subtle)' }}>Fidelity</span>
          <span style={{ color: fidelity === 'lower' ? '#b45309' : 'var(--life-color-text-default)', fontWeight: fidelity === 'lower' ? 700 : 400 }}>
            {fidelity === 'lower' ? 'Lower (best-effort)' : 'High'}
          </span>
          <span style={{ color: 'var(--life-color-text-subtle)' }}>Detected title</span>
          <span style={{ color: 'var(--life-color-text-default)' }}>{title}</span>
          <span style={{ color: 'var(--life-color-text-subtle)' }}>Detected sections</span>
          <span style={{ color: 'var(--life-color-text-default)' }}>{sectionCount}</span>
        </div>

        {fidelity === 'lower' && (fileType === 'pdf' || fileType === 'pptx') && (
          <div
            className="mb-3 flex items-start gap-2 rounded-md px-3 py-2"
            style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#b45309' }} />
            <span style={{ fontSize: 13, color: '#92400e' }}>{FIDELITY_WARNING[fileType]}</span>
          </div>
        )}

        {courseIdMismatch && (
          <div
            className="mb-3 flex items-start gap-2 rounded-md px-3 py-2"
            style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#b45309' }} />
            <span style={{ fontSize: 13, color: '#92400e' }}>
              This file was exported from a different course — "Update content only" isn't offered, since position-matching it against this course could patch the wrong content. Use Replace or Append instead.
            </span>
          </div>
        )}

        {normalizedDocument ? (
          <>
            <div className="mb-3">
              <div className="mb-1" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--life-color-text-subtle)' }}>
                Generated hierarchy
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md p-2" style={{ border: '1px solid var(--life-color-border-subtle)' }}>
                <HierarchyTree sections={normalizedDocument.sections} />
              </div>
            </div>
            {snippet && (
              <div className="mb-3">
                <div className="mb-1" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--life-color-text-subtle)' }}>
                  Content preview
                </div>
                <p className="line-clamp-4" style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>{snippet}</p>
              </div>
            )}
          </>
        ) : (
          <p className="mb-3" style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>
            A detailed hierarchy preview isn't available for this file type yet — the parsed content ({(blocks as unknown[]).length} block(s)) will still be shown in the editor for review.
          </p>
        )}

        {warnings.length > 0 && (
          <div className="mb-3">
            <div className="mb-1" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--life-color-text-subtle)' }}>
              Import warnings
            </div>
            <ul className="max-h-28 space-y-1 overflow-y-auto" style={{ fontSize: 13, color: '#92400e' }}>
              {warnings.map((w, i) => <li key={i}>• {w.message}</li>)}
            </ul>
          </div>
        )}

        <div className="mb-3">
          <div className="mb-1" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--life-color-text-subtle)' }}>
            Validation {planLoading && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
          </div>
          {plan && plan.issues.length > 0 ? (
            <ul className="space-y-1" style={{ fontSize: 13, color: '#b42318' }}>
              {plan.issues.map((issue, i) => <li key={i}>• {issue}</li>)}
            </ul>
          ) : plan ? (
            <p style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>
              No blocking issues — {plan.topics} topic(s), {plan.sections} section(s), {plan.groups} content group(s), {plan.components} component(s) would be generated.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>Validate by saving/generating from a course to see this.</p>
          )}
        </div>

        <div className="mb-4">
          <div className="mb-1" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--life-color-text-subtle)' }}>
            Import mode
          </div>
          <div className="space-y-1.5">
            {modeOptions.map((opt) => (
              <label
                key={opt.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5"
                style={{ opacity: opt.disabled ? 0.5 : 1, cursor: opt.disabled ? 'not-allowed' : 'pointer' }}
              >
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === opt.id}
                  disabled={opt.disabled}
                  onChange={() => setMode(opt.id)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: opt.danger && mode === opt.id ? '#b42318' : 'var(--life-color-text-default)' }}>
                    {opt.label}
                  </span>
                  <span className="block" style={{ fontSize: 12, color: 'var(--life-color-text-subtle)' }}>{opt.help}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="sb-toolbar-btn">Cancel</button>
          <button
            type="button"
            onClick={() => onConfirm(mode)}
            className={`sb-toolbar-btn ${mode === 'replace' ? '' : 'sb-toolbar-btn-primary'}`}
            style={mode === 'replace' ? { background: '#b42318', color: '#fff', borderColor: '#b42318' } : undefined}
          >
            {mode === 'replace' ? 'Replace storyboard' : mode === 'reimport' ? 'Update content' : 'Confirm import'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
