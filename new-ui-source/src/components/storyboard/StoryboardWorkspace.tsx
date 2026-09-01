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

const NEXT_STATUS: Record<StoryboardStatus, StoryboardStatus> = {
  draft: 'in_review',
  in_review: 'approved',
  approved: 'draft',
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

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const review = useStoryboardReview(sb.storyboardId);
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

  // Pull the latest backend course structure into the storyboard on demand
  // (spec §1 — keep the storyboard synchronized with the AT). Guarded so it
  // never discards unsaved edits.
  const refreshFromCourse = async () => {
    if (!courseId) return;
    if (sb.dirty) {
      flash('Save your changes first — then refresh from the course.');
      return;
    }
    flash('Refreshing from course…');
    try {
      const fresh = stripPlaceholderHeadings(await getCourseStoryboardBlocks(courseId));
      if (fresh.length) {
        editorRef.current?.setDocument(fresh);
        sb.setDocument(fresh);
        sb.markSaved(fresh);
        setHeadings(editorRef.current?.getHeadings() ?? []);
        setSummary(editorRef.current?.getSummary() ?? EMPTY_SUMMARY);
        flash('Storyboard updated from the latest course content.');
      } else {
        flash('No course content to load yet.');
      }
    } catch (e) {
      flash(`Refresh failed — ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const stub = (action: string, phase: string) => flash(`${action} — arrives in ${phase}.`);

  // Document-level "Enrich with AI" (toolbar): open the SAME Samaritan popup,
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

  const cycleStatus = async () => {
    if (!sb.storyboardId) return;
    const next = NEXT_STATUS[sb.status];
    try {
      // Snapshot-on-approval (AC8): persist the current document before approving.
      if (next === 'approved') await sb.save();
      await sb.changeStatus(next);
      await review.refresh(); // reflect the new status_change audit event
    } catch {
      flash('Could not change status.');
    }
  };

  // Import a Word/PDF/PPTX file → blocks, then load them into the editor (AC10).
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx,.pdf,.pptx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const format: ImportFormat = ext === 'pdf' ? 'pdf' : ext === 'pptx' ? 'pptx' : 'word';
      flash('Importing…');
      try {
        const b64 = await readFileBase64(file);
        const { blocks } = await importStoryboardDocument(format, b64);
        if (Array.isArray(blocks) && blocks.length) {
          editorRef.current?.setDocument(blocks);
          sb.setDocument(blocks);
          flash(`Imported ${blocks.length} block(s) — review, then Save.`);
        } else {
          flash('Nothing importable found in that file.');
        }
      } catch (e) {
        flash(`Import failed — ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    };
    input.click();
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
      // Name the download after the course title (fall back to the server name).
      const ext = isPdf ? 'pdf' : 'docx';
      const safeCourse = titleForExport.trim().replace(/[\\/:*?"<>|]+/g, '_');
      const downloadName = safeCourse ? `${safeCourse}.${ext}` : filename;
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
        onCycleStatus={cycleStatus}
        onBack={() => onBack?.()}
        onStub={stub}
        onImport={handleImport}
        onExport={handleExport}
        onGenerate={generate}
        onSave={handleSave}
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
            onRefresh={courseId ? refreshFromCourse : undefined}
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
