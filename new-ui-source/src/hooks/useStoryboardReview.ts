// Review/comments data for a storyboard (ADAPT-3760, Phase 5 / AC8 / AC9).
// Loads comment threads + the audit trail from the Phase 1 backend and exposes
// add / reply / resolve / delete operations that refresh on success.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listStoryboardComments,
  addStoryboardComment,
  updateStoryboardComment,
  deleteStoryboardComment,
  listStoryboardAudit,
  type StoryboardComment,
  type StoryboardAuditEvent,
} from "../api/adaptAuthoring";

export interface UseStoryboardReviewResult {
  comments: StoryboardComment[];
  audit: StoryboardAuditEvent[];
  openCount: number;
  resolvedCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  addComment: (blockId: string, body: string, courseId?: string, parentCommentId?: string) => Promise<void>;
  setResolved: (commentId: string, resolved: boolean) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
}

export function useStoryboardReview(storyboardId?: string): UseStoryboardReviewResult {
  const [comments, setComments] = useState<StoryboardComment[]>([]);
  const [audit, setAudit] = useState<StoryboardAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!storyboardId) {
      setComments([]);
      setAudit([]);
      return;
    }
    setLoading(true);
    try {
      const [c, a] = await Promise.all([
        listStoryboardComments(storyboardId),
        listStoryboardAudit(storyboardId),
      ]);
      setComments(Array.isArray(c) ? c : []);
      setAudit(Array.isArray(a) ? a : []);
    } catch {
      /* leave previous state; the panel shows empty states */
    } finally {
      setLoading(false);
    }
  }, [storyboardId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addComment = useCallback(
    async (blockId: string, body: string, courseId?: string, parentCommentId?: string) => {
      if (!storyboardId || !body.trim()) return;
      await addStoryboardComment(storyboardId, {
        blockId,
        body: body.trim(),
        _courseId: courseId,
        _parentCommentId: parentCommentId,
      });
      await refresh();
    },
    [storyboardId, refresh]
  );

  const setResolved = useCallback(
    async (commentId: string, resolved: boolean) => {
      await updateStoryboardComment(commentId, { resolved });
      await refresh();
    },
    [refresh]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      await deleteStoryboardComment(commentId);
      await refresh();
    },
    [refresh]
  );

  const { openCount, resolvedCount } = useMemo(() => {
    const tops = comments.filter((c) => !c._parentCommentId);
    return {
      openCount: tops.filter((c) => !c.resolved).length,
      resolvedCount: tops.filter((c) => c.resolved).length,
    };
  }, [comments]);

  return { comments, audit, openCount, resolvedCount, loading, refresh, addComment, setResolved, removeComment };
}
