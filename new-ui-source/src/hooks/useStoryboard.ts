// Storyboard editing model (ADAPT-3779). Mirrors useCourseStructure: edits are
// staged in a local DRAFT (the BlockNote document) and only written to the
// backend when the caller invokes save(); discard() reverts to the last-saved
// state; `dirty` is a JSON diff against the last save. On first load it fetches
// the course's storyboard, lazily creating one if none exists.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getStoryboardByCourse,
  getStoryboard,
  createStoryboard,
  updateStoryboard,
  shareStoryboard,
  type StoryboardRecord,
  type StoryboardStatus,
} from "../api/adaptAuthoring";

export interface UseStoryboardResult {
  storyboardId?: string;
  document: unknown[];
  status: StoryboardStatus;
  version: number;
  /** User ids the storyboard is currently shared with for review. */
  shareWithUsers: string[];
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error?: string;
  /** Stage a new document in the draft (does not persist). */
  setDocument: (doc: unknown[]) => void;
  /** Reset the dirty baseline to `doc` (or the current draft) without saving. */
  markSaved: (doc?: unknown[]) => void;
  /**
   * Persist a document to the backend. Defaults to the draft, but callers
   * that hold a fresher document (e.g. read straight off the live editor)
   * can pass it explicitly so what's persisted always matches what's on
   * screen — see the Export flow, which must not rely on the `dirty` flag
   * (bootstrap-projected content is marked "saved" for UI purposes without
   * ever having been PUT to the backend record).
   */
  save: (doc?: unknown[]) => Promise<void>;
  /** Revert the draft to the last-saved document. */
  discard: () => void;
  /** Re-fetch `status` from the server — status is now fully automatic
   *  (comment-driven, computed server-side), so callers that just added/
   *  resolved/removed a comment call this to pick up the new value without
   *  waiting for a full reload. Only refreshes `status`, never the document
   *  (never discards in-progress edits). */
  refreshStatus: () => Promise<void>;
  /** Share the storyboard with the given reviewers (persists + audits server-side). */
  share: (userIds: string[]) => Promise<void>;
}

export function useStoryboard(courseId?: string): UseStoryboardResult {
  const [record, setRecord] = useState<StoryboardRecord | null>(null); // last-saved
  const [draftDoc, setDraftDoc] = useState<unknown[]>([]);
  const [status, setStatus] = useState<StoryboardStatus>("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // JSON of the last-saved document, for the dirty diff (mirrors useCourseStructure).
  const savedJson = useRef<string>("[]");

  useEffect(() => {
    let cancelled = false;
    if (!courseId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(undefined);
      try {
        let rec = await getStoryboardByCourse(courseId);
        if (!rec) rec = await createStoryboard({ _courseId: courseId });
        if (cancelled) return;
        const doc = rec.documentJson ?? [];
        setRecord(rec);
        setDraftDoc(doc);
        setStatus(rec.status);
        savedJson.current = JSON.stringify(doc);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load storyboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const dirty = useMemo(() => JSON.stringify(draftDoc) !== savedJson.current, [draftDoc]);

  const setDocument = useCallback((doc: unknown[]) => setDraftDoc(doc), []);

  const markSaved = useCallback(
    (doc?: unknown[]) => {
      savedJson.current = JSON.stringify(doc ?? draftDoc);
    },
    [draftDoc]
  );

  const save = useCallback(async (doc?: unknown[]) => {
    if (!record) return;
    const docToSave = doc ?? draftDoc;
    setSaving(true);
    setError(undefined);
    try {
      const updated = await updateStoryboard(record._id, { documentJson: docToSave });
      setRecord(updated);
      setDraftDoc(updated.documentJson ?? docToSave);
      savedJson.current = JSON.stringify(updated.documentJson ?? docToSave);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save storyboard");
      throw e;
    } finally {
      setSaving(false);
    }
  }, [record, draftDoc]);

  const discard = useCallback(() => {
    setDraftDoc(record?.documentJson ?? []);
  }, [record]);

  const refreshStatus = useCallback(async () => {
    if (!record) return;
    try {
      const fresh = await getStoryboard(record._id);
      setStatus(fresh.status);
    } catch {
      /* best-effort — a stale pill self-corrects on next reload */
    }
  }, [record]);

  const share = useCallback(
    async (userIds: string[]) => {
      if (!record) return;
      const updated = await shareStoryboard(record._id, userIds);
      setRecord(updated);
    },
    [record]
  );

  return {
    storyboardId: record?._id,
    document: draftDoc,
    status,
    version: record?.version ?? 1,
    shareWithUsers: record?._shareWithUsers ?? [],
    loading,
    saving,
    dirty,
    error,
    setDocument,
    markSaved,
    save,
    discard,
    refreshStatus,
    share,
  };
}
