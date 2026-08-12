// Storyboard workspace — full 3-panel document experience (ADAPT-3760),
// matching the Lovable reference. Chrome-free of any route concerns so it can
// be a full-screen route (StoryboardPage) or embedded in Course Configuration.
//
//   Top bar   — StoryboardTopBar (save, status, import/ai/export/share/generate)
//   Left       — ContentsPanel (TOC + AI guidance)
//   Center     — DocumentToolbar + COURSE header + BlockNote canvas
//
// Persistence is backed by useStoryboard (ADAPT-3779): the document is loaded
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
import { storyboardAi, type StoryboardAiAction } from '@/api/ai';
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

// Starter content for a brand-new storyboard (mirrors the editor's own default).
const STARTER_DOCUMENT: unknown[] = [
  { type: 'heading', props: { level: 1 }, content: 'New Page Title' },
  { type: 'heading', props: { level: 2 }, content: 'New Section Title' },
  { type: 'paragraph', content: '' },
];

export default function StoryboardWorkspace({
  courseId,
  courseTitle = 'Untitled course',
  initialDocument,
  onBack,
}: {
  courseId?: string;
  courseTitle?: string;
  initialDocument?: StoryboardDocument;
  onBack?: () => void;
}) {
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

  // Once the storyboard has loaded, decide the editor's initial content.
  // Priority: the last-saved storyboard document (so nothing the author did —
  // including chosen media assets held in card data — is ever lost on reload),
  // then a projection of the live course (first open of an existing course, so
  // the storyboard mirrors it), then any passed-in doc, then starter content.
  useEffect(() => {
    if (sb.loading || bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      let doc: unknown[] | null =
        Array.isArray(sb.document) && sb.document.length ? (sb.document as unknown[]) : null;
      const fromSaved = !!doc;
      if (!doc && courseId) {
        try {
          const courseBlocks = await getCourseStoryboardBlocks(courseId);
          if (courseBlocks.length) doc = courseBlocks;
        } catch {
          /* fall back to the passed-in doc / starter below */
        }
      }
      if (!doc) {
        doc =
          Array.isArray(initialDocument) && (initialDocument as unknown[]).length
            ? (initialDocument as unknown[])
            : STARTER_DOCUMENT;
      }
      initialContent.current = doc;
      sb.setDocument(doc);
      // Only the already-saved document is clean; a fresh course projection is
      // staged so the first Save writes it through.
      if (fromSaved) sb.markSaved(doc);
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

  const stub = (action: string, phase: string) => flash(`${action} — arrives in ${phase}.`);

  // AI actions (AC7) operate on the cursor block's text via the server proxy.
  // Improve/Rewrite replace the block; Summarize/Suggest append a paragraph.
  const runAi = async (action: StoryboardAiAction) => {
    const text = editorRef.current?.getActiveText() ?? '';
    if (!text.trim()) {
      flash('Place the cursor in a block with text first.');
      return;
    }
    flash('Asking Samaritan…');
    try {
      const result = (await storyboardAi(action, text, courseTitle)).trim();
      if (!result) {
        flash('AI returned no content.');
        return;
      }
      if (action === 'improve' || action === 'rewrite') editorRef.current?.replaceActive(result);
      else editorRef.current?.insertAfterActive(result);
      flash('AI suggestion applied.');
    } catch (e) {
      flash(`AI failed — ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const handleSave = async () => {
    const doc = editorRef.current?.getDocument() as unknown[] | undefined;
    try {
      let msg = 'Storyboard saved.';
      // Write content edits back to the live course (source of truth, AC11).
      if (courseId && doc) {
        const r = await saveStoryboardToCourse(courseId, doc);
        msg =
          `Saved to course — ${r.updatedTitles} title(s), ${r.updatedBodies} text edit(s).` +
          (r.unmapped ? ` ${r.unmapped} new block(s) need course generation (Phase 4).` : '');
      }
      // Also persist the storyboard snapshot (documentJson) if we have a record.
      if (sb.storyboardId) await sb.save();
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
      if (sb.dirty) await sb.save(); // export reads the persisted document
      const { filename, mime, dataBase64 } = isPdf
        ? await exportStoryboardPdf(sb.storyboardId)
        : await exportStoryboardWord(sb.storyboardId);
      triggerDownload(base64ToBlob(dataBase64, mime), filename);
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
      const fresh = await getCourseStoryboardBlocks(courseId);
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
        onAiAction={runAi}
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
          <DocumentToolbar onInsert={insert} onInsertHeading={insertHeading} onEnrichAI={() => runAi('improve')} />
          <div className="flex-1 overflow-y-auto">
            <article className="mx-auto max-w-3xl px-8 py-10">
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--samaritan)' }}>
                Course
              </div>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-foreground">{courseTitle}</h1>
              <hr className="my-6 border-border" />
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
