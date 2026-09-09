// Storyboard workspace — full 3-panel document experience,
// matching the Lovable reference. Chrome-free of any route concerns so it can
// be a full-screen route (StoryboardPage) or embedded in Course Configuration.
//
//   Top bar   — StoryboardTopBar (save, status, import/ai/export/share/generate)
//   Left       — ContentsPanel (TOC + AI guidance)
//   Center     — DocumentToolbar + COURSE header + BlockNote canvas
//
// Persistence is backed by useStoryboard : the document is loaded
// once, edits are staged in the hook's draft, and Save PUTs it back. Because
// BlockNote reads its initial content only once, the editor is mounted *after*
// the storyboard has loaded (and starter content seeded), keyed on the id.

import { useEffect, useRef, useState } from 'react';
import { Loader2, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import type {
  ActiveBlockInfo,
  StoryboardDocument,
  StoryboardEditorHandle,
  StoryboardHeading,
  StoryboardInsertKind,
  StoryboardSummary,
} from '@/types/storyboard';
import { useStoryboard } from '@/hooks/useStoryboard';
import { useStoryboardReview } from '@/hooks/useStoryboardReview';
import {
  getCourseStoryboardBlocks,
  saveStoryboardToCourse,
  exportStoryboardWord,
  exportStoryboardPdf,
  importStoryboardDocument,
  updateStoryboard,
  addStoryboardAudit,
  type ImportFormat,
  type StoryboardStatus,
} from '@/api/adaptAuthoring';
import type { ImportMode, NormalizedDocument } from '@/types/storyboardImport';
import { applyContentOnlyImport } from '@/api/storyboardContentUpdate';
import ImportPreviewDialog from './ImportPreviewDialog';
import { isDefaultSchemaTitle, stripPlaceholderHeadings } from './placeholderTitles';
import {
  planStoryboardGeneration,
  generateStoryboardCourse,
  type GenerationPlan,
  type GenerationResult,
} from '@/api/storyboardGeneration';
import { BlockNoteStoryboardEditor } from './BlockNoteStoryboardEditor';
import ContentsPanel from './ContentsPanel';
import DocumentToolbar from './DocumentToolbar';
import StoryboardTopBar from './StoryboardTopBar';
import ReviewCenter from './ReviewCenter';
import GenerateDialog from './GenerateDialog';
import AiAssistPopover from './AiAssistPopover';
import CommentPopover from './CommentPopover';
import ShareForReviewDialog from './ShareForReviewDialog';
import { storyboardActions, type AiAssistRequest, type CommentRequest } from './storyboardActions';

const EMPTY_SUMMARY: StoryboardSummary = {
  topics: 0,
  sections: 0,
  contentItems: 0,
  assets: 0,
  textBlocks: 0,
  hasVisual: false,
  hasAssessment: false,
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Soft client-side pre-check only — the server enforces the real limit
// (configured maxFileUploadSize) and returns a friendly error if exceeded.
// This just avoids an obviously-doomed upload round-trip.
const MAX_CLIENT_IMPORT_FILE_MB = 100;
const IMPORT_EXTENSIONS: Record<string, ImportFormat> = { docx: 'word', pdf: 'pdf', pptx: 'pptx' };

interface PendingImport {
  fileName: string;
  fileType: 'docx' | 'pdf' | 'pptx';
  normalizedDocument: NormalizedDocument | null;
  blocks: unknown[];
}

// Starter content for a brand-new storyboard. Deliberately EMPTY of any
// placeholder title text — historically we seeded "New Page Title" / "New
// Section Title" here, but those strings leaked into Preview and the Word
// export as if they were authored content. An empty paragraph
// gives BlockNote a valid initial block without any visible scaffolding.
const STARTER_DOCUMENT: unknown[] = [
  { type: 'paragraph', content: '' },
];

export default function StoryboardWorkspace({
  courseId,
  courseTitle = '',
  initialDocument,
  onBack,
}: {
  courseId?: string;
  courseTitle?: string;
  initialDocument?: StoryboardDocument;
  onBack?: () => void;
}) {
  // Filter out the backend's schema-default course title ("New Course Title"
  // and friends) so the placeholder never leaks onto the storyboard header,
  // into the export filename or into the docx title. This is the storyboard's
  // own concern — callers pass the raw course title through unchanged.
  const resolvedCourseTitle = isDefaultSchemaTitle(courseTitle) ? '' : courseTitle;
  const sb = useStoryboard(courseId);
  const review = useStoryboardReview(sb.storyboardId, sb.refreshStatus);
  const editorRef = useRef<StoryboardEditorHandle>(null);

  const [headings, setHeadings] = useState<StoryboardHeading[]>([]);
  const [summary, setSummary] = useState<StoryboardSummary>(EMPTY_SUMMARY);
  const [activeId, setActiveId] = useState<string>();
  const [activeBlock, setActiveBlock] = useState<ActiveBlockInfo | null>(null);
  const [showContents, setShowContents] = useState(true);
  const [showReview, setShowReview] = useState(true);
  const [toast, setToast] = useState<string>();
  // Component-action popovers (AI Assistance / Comment). Opened by the card
  // header actions via the storyboardActions channel — NOT from Add Content.
  const [aiConfig, setAiConfig] = useState<AiAssistRequest | null>(null);
  const [commentConfig, setCommentConfig] = useState<CommentRequest | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<PendingImport | null>(null);

  // Register the card→workspace action channel (cards render inside BlockNote).
  useEffect(
    () =>
      storyboardActions.register({
        openAi: (req) => setAiConfig(req),
        openComment: (req) => setCommentConfig(req),
      }),
    []
  );

  // Course generation (AC11) dialog state.
  const [genOpen, setGenOpen] = useState(false);
  const [genPlan, setGenPlan] = useState<GenerationPlan | null>(null);
  const [genRunning, setGenRunning] = useState(false);
  const [genResult, setGenResult] = useState<GenerationResult | null>(null);

  // Resolve a block id to a human label for the Review panel (AC9).
  const labelFor = (blockId: string): string => {
    const h = headings.find((x) => x.id === blockId);
    if (h) return `H${h.level} · ${h.text || 'Untitled'}`;
    if (activeBlock && activeBlock.id === blockId && activeBlock.text) return activeBlock.text;
    return '(content block)';
  };

  // The editor mounts once, after load, with this exact content — captured so
  // the hook draft and the editor start perfectly in sync.
  const [booted, setBooted] = useState(false);
  const initialContent = useRef<unknown[]>(STARTER_DOCUMENT);
  const bootstrapped = useRef(false);
  // block id → generated content id, for idempotent regeneration (AC11).
  const generatedMap = useRef<Record<string, string>>({});

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(undefined), 2600);
  };

  // Once the storyboard has loaded, decide the editor's initial content. The
  // live course is the source of truth (spec: the storyboard is always generated
  // from the latest backend course structure), so we project it first — this
  // reflects edits made anywhere in the AT. Fallbacks: the last-saved storyboard
  // snapshot, any passed-in doc, then starter content. Save keeps them in sync.
  useEffect(() => {
    if (sb.loading || bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      let doc: unknown[] | null = null;
      if (courseId) {
        try {
          const courseBlocks = await getCourseStoryboardBlocks(courseId);
          if (courseBlocks.length) doc = courseBlocks;
        } catch {
          /* fall back to the saved snapshot / starter below */
        }
      }
      if (!doc) {
        doc =
          Array.isArray(sb.document) && sb.document.length
            ? (sb.document as unknown[])
            : Array.isArray(initialDocument) && (initialDocument as unknown[]).length
              ? (initialDocument as unknown[])
              : STARTER_DOCUMENT;
      }
      // Regardless of source, strip any placeholder heading text.
      // The course projector already skips defaults, but a persisted DB
      // snapshot from before that filter — or a snapshot captured from a
      // course that was later edited to remove real titles — can still carry
      // "New Article Title", "New Block Title" etc. as heading content.
      doc = stripPlaceholderHeadings(doc);
      if (!doc.length) doc = STARTER_DOCUMENT;
      initialContent.current = doc;
      sb.setDocument(doc);
      sb.markSaved(doc); // seeding from the backend is not an unsaved edit
      setBooted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb.loading]);

  // Populate TOC + summary from the initial content (the editor doesn't emit
  // onChange on mount).
  useEffect(() => {
    if (!booted) return;
    setHeadings(editorRef.current?.getHeadings() ?? []);
    setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
  }, [booted]);

  const handleChange = (doc: StoryboardDocument, nextHeadings: StoryboardHeading[]) => {
    setHeadings(nextHeadings);
    setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
    sb.setDocument(doc as unknown[]); // stage into the hook draft (drives dirty/save)
  };

  const handleNavigate = (blockId: string) => {
    setActiveId(blockId);
    editorRef.current?.focusBlock(blockId);
  };

  const insert = (kind: StoryboardInsertKind) => editorRef.current?.insert(kind);
  const insertHeading = (level: number) => editorRef.current?.insert('heading', { level });

  // Pull the latest backend course structure into the storyboard silently
  // (spec §1 — keep the storyboard synchronized with the AT). Guarded so it
  // never discards unsaved edits. Runs automatically (see effect below) on
  // revisiting the page — there is no manual "Refresh" control.
  const refreshFromCourse = async () => {
    if (!courseId || !booted || sb.dirty) return;
    try {
      const fresh = stripPlaceholderHeadings(await getCourseStoryboardBlocks(courseId));
      if (fresh.length) {
        editorRef.current?.setDocument(fresh);
        sb.setDocument(fresh);
        sb.markSaved(fresh);
        setHeadings(editorRef.current?.getHeadings() ?? []);
        setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
      }
    } catch {
      /* silent — the current document stays as-is until the next successful sync */
    }
  };

  // Re-sync with the course whenever the user comes back to this tab/page,
  // so the storyboard never goes stale without requiring a manual refresh.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshFromCourse();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, booted, sb.dirty]);

  // Document-level "Ask Samaritan" (toolbar): open the SAME Samaritan popup,
  // seeded from the cursor block. Insert → new Text component at the cursor;
  // Replace → rewrite the cursor block. (Card-level AI supplies its own
  // handlers via the storyboardActions channel.)
  const openEnrichAi = () => {
    setAiConfig({
      initialText: activeBlock?.text || editorRef.current?.getActiveText() || '',
      onInsert: (text) => {
        editorRef.current?.insertComponent('text', { data: { description: text, showTitle: false } });
        setHeadings(editorRef.current?.getHeadings() ?? []);
        setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
      },
      onReplace: (text) => editorRef.current?.replaceActive(text),
    });
  };

  const handleSave = async () => {
    const doc = editorRef.current?.getDocument() as unknown[] | undefined;
    try {
      let msg = 'Storyboard saved.';
      if (courseId && doc) {
        // 1. Write edits to EXISTING course content (titles, text, media/_media).
        const r = await saveStoryboardToCourse(courseId, doc);
        msg = `Saved to course — ${r.updatedTitles} title(s), ${r.updatedBodies} content edit(s).`;
        // 2. New blocks/components (incl. new media) → additively create them in
        //    the backend so nothing is left only in the draft. Never deletes.
        if (r.unmapped > 0) {
          const result = await generateStoryboardCourse(courseId, doc, generatedMap.current, { skipDeletes: true });
          generatedMap.current = { ...generatedMap.current, ...result.blockToContent };
          if (sb.storyboardId) await updateStoryboard(sb.storyboardId, { _generatedContentMap: generatedMap.current });
          if (result.created) msg += ` ${result.created} new item(s) added to the course.`;
          // Media/assessment can't persist if their component type isn't
          // installed — surface it instead of silently degrading to text.
          if (result.missingTypes.length) {
            msg += ` ⚠ Not generated (no installed plugin): ${result.missingTypes.join(', ')} — install the component plugin, then Save again. Your storyboard content is kept.`;
          }
          // 3. Re-seed from the backend so the storyboard mirrors the saved
          //    course (new content ids + canonical media) — no manual refresh.
          const fresh = stripPlaceholderHeadings(await getCourseStoryboardBlocks(courseId));
          if (fresh.length) {
            editorRef.current?.setDocument(fresh);
            sb.setDocument(fresh);
            sb.markSaved(fresh);
            setHeadings(editorRef.current?.getHeadings() ?? []);
            setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
          }
        }
      }
      // 4. Persist the storyboard snapshot (documentJson) — write what's
      //    currently on screen, so the persisted record always matches the
      //    editor content (this is what Preview + Export read from).
      if (sb.storyboardId) await sb.save(editorRef.current?.getDocument() as unknown[] | undefined);
      flash(msg);
    } catch (e) {
      flash(`Save failed — ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  // Import a Word/PDF/PPTX file → parse + normalize server-side → preview →
  // confirm → apply to the editor per the chosen mode (AC10, ADAPT-3760).
  // Nothing touches the live storyboard until the user confirms the preview.
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx,.pdf,.pptx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const format = IMPORT_EXTENSIONS[ext];
      if (!format) {
        flash(`Unsupported file format ".${ext}" — only .docx, .pdf and .pptx are supported.`);
        return;
      }
      if (!file.size) {
        flash('That file is empty.');
        return;
      }
      if (file.size > MAX_CLIENT_IMPORT_FILE_MB * 1024 * 1024) {
        flash(`That file is larger than ${MAX_CLIENT_IMPORT_FILE_MB}MB.`);
        return;
      }
      flash('Importing…');
      try {
        const { normalizedDocument, blocks } = await importStoryboardDocument(format, file);
        if (!Array.isArray(blocks) || !blocks.length) {
          flash('Nothing importable found in that file.');
          return;
        }
        setImportPreview({
          fileName: file.name,
          fileType: format === 'word' ? 'docx' : format,
          normalizedDocument,
          blocks,
        });
      } catch (e) {
        flash(`Import failed — ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    };
    input.click();
  };

  // Apply the confirmed import per the chosen mode. 'new'/'replace' both mean
  // "the imported blocks become the whole document" — the only difference is
  // which one is offered/labelled given whether there's existing content.
  // 'reimport' ("Update content only") is different in kind from the other
  // three: it doesn't stage anything into the editor draft — it patches the
  // LIVE course directly (matched by position, never touching structure —
  // see storyboardContentUpdate.ts) and then re-seeds the editor from the
  // freshly-patched course, the same pattern already used by handleSave/
  // confirmGenerate.
  const handleConfirmImport = async (mode: ImportMode) => {
    if (!importPreview) return;
    const { blocks, fileName } = importPreview;
    setImportPreview(null);

    if (mode === 'reimport') {
      if (!courseId) return;
      flash('Updating content…');
      try {
        const result = await applyContentOnlyImport(courseId, blocks);
        const fresh = stripPlaceholderHeadings(await getCourseStoryboardBlocks(courseId));
        if (fresh.length) {
          editorRef.current?.setDocument(fresh);
          sb.setDocument(fresh);
          sb.markSaved(fresh);
          setHeadings(editorRef.current?.getHeadings() ?? []);
          setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
        }
        const skipped =
          result.unmatchedCounts.topics + result.unmatchedCounts.sections +
          result.unmatchedCounts.groups + result.unmatchedCounts.components;
        let msg = `Updated ${result.updatedTitles} title(s), ${result.updatedBodies} content field(s).`;
        if (skipped > 0) {
          msg += ` ${skipped} item(s) in the file had no matching existing content and were not added — use Append if you want them included.`;
        }
        flash(msg);
      } catch (e) {
        flash(`Content update failed — ${e instanceof Error ? e.message : 'unknown error'}`);
      }
      return;
    }

    if (mode === 'replace') {
      // 'Replace' means the imported file becomes the ENTIRE course — every
      // block in it is fresh (no relationship to the existing course's content
      // ids). Staging it into the draft and leaving persistence to whichever
      // button the user clicks next is unsafe: Save's saveStoryboardToCourse
      // matches by existing id, finds nothing, and falls back to an
      // additive-only generateStoryboardCourse (skipDeletes: true) — which
      // creates a full parallel copy of the new content and never removes the
      // old, producing duplicate content and a broken course structure. So
      // Replace persists immediately via the same full reconcile (create +
      // update + delete) that "Generate Course" already uses safely.
      if (!courseId) return;
      flash('Replacing storyboard content…');
      try {
        const result = await generateStoryboardCourse(courseId, blocks, {});
        generatedMap.current = result.blockToContent;
        if (sb.storyboardId) {
          await updateStoryboard(sb.storyboardId, { _generatedContentMap: result.blockToContent });
          await addStoryboardAudit(sb.storyboardId, {
            event: 'generated',
            _courseId: courseId,
            meta: { created: result.created, updated: result.updated, deleted: result.deleted, source: 'replace-import', fileName },
          });
        }
        const fresh = stripPlaceholderHeadings(await getCourseStoryboardBlocks(courseId));
        if (fresh.length) {
          editorRef.current?.setDocument(fresh);
          sb.setDocument(fresh);
          sb.markSaved(fresh);
          setHeadings(editorRef.current?.getHeadings() ?? []);
          setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
        }
        await review.refresh();
        let msg = `Replaced with "${fileName}" — ${result.created} created, ${result.updated} updated, ${result.deleted} removed.`;
        if (result.missingTypes.length) {
          msg += ` ⚠ Not generated (no installed plugin): ${result.missingTypes.join(', ')}.`;
        }
        flash(msg);
      } catch (e) {
        flash(`Replace failed — ${e instanceof Error ? e.message : 'unknown error'}`);
      }
      return;
    }

    const nextDoc =
      mode === 'append'
        ? [...((editorRef.current?.getDocument() as unknown[] | undefined) ?? []), ...blocks]
        : blocks;
    editorRef.current?.setDocument(nextDoc);
    sb.setDocument(nextDoc);
    setHeadings(editorRef.current?.getHeadings() ?? []);
    setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
    flash(`Imported "${fileName}" (${blocks.length} block(s)) — review, then Save.`);
  };

  // Export the storyboard to Word or PDF — both server-built (AC10).
  const handleExport = async (label: string) => {
    if (!sb.storyboardId) {
      flash('Save the storyboard first to export.');
      return;
    }
    const isPdf = label.toLowerCase().includes('pdf');
    flash('Exporting…');
    try {
      // The export route reads the storyboard record's persisted documentJson
      // — NOT this component's React state — so it must be written before
      // every export, regardless of the `dirty` flag: content projected from
      // the course on load is marked "saved" for the UI (no false "unsaved
      // changes" pill) without ever having been PUT to the backend record.
      // Pull straight from the live editor and scrub any placeholder-title
      // headings so the persisted document (and therefore the export) matches
      // exactly what Preview shows, not the legacy scaffolding.
      const liveDoc = stripPlaceholderHeadings(
        (editorRef.current?.getDocument() as unknown[] | undefined) ?? [],
      );
      await sb.save(liveDoc);
      const titleForExport = resolvedCourseTitle;
      const { filename, mime, dataBase64 } = isPdf
        ? await exportStoryboardPdf(sb.storyboardId, titleForExport)
        : await exportStoryboardWord(sb.storyboardId, titleForExport);
      // Filename is keyed on Course ID, not the course title (ADAPT-3760
      // import enhancements — Course-ID-based mapping), so a later import can
      // reliably identify which course a file belongs to.
      const ext = isPdf ? 'pdf' : 'docx';
      const downloadName = courseId ? `${courseId}.${ext}` : filename;
      triggerDownload(base64ToBlob(dataBase64, mime), downloadName);
    } catch (e) {
      flash(`Export failed — ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  // Open the Generate dialog and compute a validation plan (AC11).
  const generate = async () => {
    if (!courseId) {
      flash('No course to generate into.');
      return;
    }
    setGenOpen(true);
    setGenResult(null);
    setGenPlan(null);
    try {
      const doc = (editorRef.current?.getDocument() as unknown[]) ?? [];
      setGenPlan(await planStoryboardGeneration(courseId, doc, generatedMap.current));
    } catch (e) {
      setGenPlan({
        topics: 0,
        sections: 0,
        groups: 0,
        components: 0,
        willDelete: 0,
        issues: [`Could not analyse: ${e instanceof Error ? e.message : 'unknown error'}`],
        warnings: [],
      });
    }
  };

  // Apply generation, then re-seed the document from the course (idempotency)
  // and record the audit event.
  const confirmGenerate = async () => {
    if (!courseId) return;
    const doc = (editorRef.current?.getDocument() as unknown[]) ?? [];
    setGenRunning(true);
    try {
      const result = await generateStoryboardCourse(courseId, doc, generatedMap.current);
      generatedMap.current = result.blockToContent;
      if (sb.storyboardId) {
        await updateStoryboard(sb.storyboardId, { _generatedContentMap: result.blockToContent });
        await addStoryboardAudit(sb.storyboardId, {
          event: 'generated',
          _courseId: courseId,
          meta: { created: result.created, updated: result.updated, deleted: result.deleted },
        });
      }
      // Re-seed from the freshly-generated course so every block carries a
      // content id — the next generation is then a no-op.
      const fresh = stripPlaceholderHeadings(await getCourseStoryboardBlocks(courseId));
      if (fresh.length) {
        editorRef.current?.setDocument(fresh);
        sb.setDocument(fresh);
        sb.markSaved(fresh);
      }
      await review.refresh();
      setGenResult(result);
    } catch (e) {
      setGenOpen(false);
      flash(`Generation failed — ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setGenRunning(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <StoryboardTopBar
        status={sb.status}
        onBack={() => onBack?.()}
        onImport={handleImport}
        onExport={handleExport}
        onGenerate={generate}
        onSave={handleSave}
        onShareForReview={() => setShareOpen(true)}
        dirty={sb.dirty}
        saving={sb.saving}
      />

      {sb.error && (
        <div className="border-b border-[#fecaca] bg-[#fef2f2] px-4 py-2 text-sm text-[#991b1b]">
          {sb.error}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left — Contents */}
        {showContents ? (
          <div className="w-64 shrink-0 border-r">
            <ContentsPanel
              headings={headings}
              summary={summary}
              activeId={activeId}
              onNavigate={handleNavigate}
              onCollapse={() => setShowContents(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            aria-label="Show contents"
            onClick={() => setShowContents(true)}
            className="grid w-9 shrink-0 place-items-start border-r pt-3 text-muted-foreground hover:bg-muted"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* Center — document */}
        <main className="flex min-w-0 flex-1 flex-col bg-background">
          <DocumentToolbar
            onInsert={insert}
            onInsertHeading={insertHeading}
            onEnrichAI={openEnrichAi}
          />
          <div className="flex-1 overflow-y-auto">
            {/* Authoring canvas ~60% of the viewport (Lovable proportions),
                capped to the center column when the side panels squeeze it. */}
            <article className="mx-auto w-[60vw] max-w-full px-8 py-10">
              {/* Show a course header ONLY when the backend has a real title.
                  When the course is unnamed (or still carrying the schema
                  default like "New Course Title") we suppress the entire
                  Course/H1 block — forbids rendering placeholder
                  title text on the storyboard, in Preview, or in the export. */}
              {resolvedCourseTitle ? (
                <div className="mb-8 border-b pb-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--samaritan)' }}>
                    Course
                  </div>
                  <h1 className="mt-1 text-[2.6rem] font-bold leading-tight tracking-tight text-foreground">
                    {resolvedCourseTitle}
                  </h1>
                </div>
              ) : null}
              {booted ? (
                <BlockNoteStoryboardEditor
                  key={sb.storyboardId ?? 'sb'}
                  ref={editorRef}
                  initialDocument={initialContent.current}
                  onChange={handleChange}
                  onActiveBlock={setActiveBlock}
                />
              ) : (
                <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading storyboard…
                </div>
              )}
            </article>
          </div>
        </main>

        {/* Right — Review Center (comments + audit, AC8/AC9) */}
        {showReview ? (
          <div className="w-80 shrink-0 border-l">
            <ReviewCenter
              summary={summary}
              review={review}
              status={sb.status}
              activeBlock={activeBlock ? { id: activeBlock.id, label: labelFor(activeBlock.id) } : undefined}
              courseId={courseId}
              labelFor={labelFor}
              onCollapse={() => setShowReview(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            aria-label="Show review center"
            onClick={() => setShowReview(true)}
            className="grid w-9 shrink-0 place-items-start border-l pt-3 text-muted-foreground hover:bg-muted"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {genOpen && (
        <GenerateDialog
          plan={genPlan}
          running={genRunning}
          result={genResult}
          onConfirm={confirmGenerate}
          onClose={() => setGenOpen(false)}
        />
      )}

      {aiConfig && (
        <AiAssistPopover
          initialText={aiConfig.initialText || ''}
          courseContext={resolvedCourseTitle}
          onInsert={(t) => {
            aiConfig.onInsert(t);
            flash('AI content inserted as a component. Save to persist it.');
          }}
          onReplace={(t) => {
            aiConfig.onReplace(t);
            flash('AI content applied.');
          }}
          onClose={() => setAiConfig(null)}
        />
      )}

      {shareOpen && (
        <ShareForReviewDialog
          sharedWith={sb.shareWithUsers}
          onShare={async (userIds) => {
            await sb.share(userIds);
            flash(`Shared with ${userIds.length} reviewer(s).`);
          }}
          onClose={() => setShareOpen(false)}
        />
      )}

      {importPreview && (
        <ImportPreviewDialog
          fileName={importPreview.fileName}
          fileType={importPreview.fileType}
          normalizedDocument={importPreview.normalizedDocument}
          blocks={importPreview.blocks}
          courseId={courseId}
          hasExistingContent={headings.length > 0 || summary.contentItems > 0 || summary.textBlocks > 0}
          // "Update content only" is only offered when the file's embedded
          // Course ID marker confirms it came from THIS course — position-
          // matching an unrelated document risks patching the wrong content.
          canUpdateContentOnly={!!courseId && importPreview.normalizedDocument?.metadata.courseId === courseId}
          courseIdMismatch={
            !!importPreview.normalizedDocument?.metadata.courseId &&
            importPreview.normalizedDocument.metadata.courseId !== courseId
          }
          onConfirm={handleConfirmImport}
          onClose={() => setImportPreview(null)}
        />
      )}

      {commentConfig && (
        <CommentPopover
          blockId={commentConfig.blockId}
          blockLabel={commentConfig.label}
          courseId={courseId}
          comments={review.comments}
          loading={review.loading}
          onAdd={review.addComment}
          onResolve={review.setResolved}
          onDelete={review.removeComment}
          onClose={() => setCommentConfig(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
