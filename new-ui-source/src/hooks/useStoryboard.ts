// Storyboard editing model (ADAPT-3779). Mirrors useCourseStructure: edits are
// staged in a local DRAFT (the BlockNote document) and only written to the
// backend when the caller invokes save(); discard() reverts to the last-saved
// state; `dirty` is a JSON diff against the last save. On first load it fetches
// the course's storyboard, lazily creating one if none exists.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getStoryboardByCourse,
  createStoryboard,
  updateStoryboard,
  setStoryboardStatus,
  type StoryboardRecord,
  type StoryboardStatus,
} from "../api/adaptAuthoring";

export interface UseStoryboardResult {
  storyboardId?: string;
  document: unknown[];
  status: StoryboardStatus;
  version: number;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error?: string;
  /** Stage a new document in the draft (does not persist). */
  setDocument: (doc: unknown[]) => void;
  /** Reset the dirty baseline to `doc` (or the current draft) without saving. */
  markSaved: (doc?: unknown[]) => void;
  /** Persist the draft document to the backend. */
  save: () => Promise<void>;
  /** Revert the draft to the last-saved document. */
  discard: () => void;
  /** Change review status (persists + records an audit event server-side). */
  changeStatus: (next: StoryboardStatus) => Promise<void>;
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

  const save = useCallback(async () => {
    if (!record) return;
    setSaving(true);
    setError(undefined);
    try {
      const updated = await updateStoryboard(record._id, { documentJson: draftDoc });
      setRecord(updated);
      savedJson.current = JSON.stringify(updated.documentJson ?? draftDoc);
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

  const changeStatus = useCallback(
    async (next: StoryboardStatus) => {
      if (!record) return;
      const updated = await setStoryboardStatus(record._id, next);
      setRecord(updated);
      setStatus(updated.status);
    },
    [record]
  );

  return {
    storyboardId: record?._id,
    document: draftDoc,
    status,
    version: record?.version ?? 1,
    loading,
    saving,
    dirty,
    error,
    setDocument,
    markSaved,
    save,
    discard,
    changeStatus,
  };
}
