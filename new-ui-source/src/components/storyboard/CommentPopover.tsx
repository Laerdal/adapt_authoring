// Block-anchored comment popover for the storyboard (ADAPT-3760).
//
// Opened from Add Content → Comment. Reuses the existing storyboardcomment
// backend via useStoryboardReview (add / resolve / delete / reply) — comments
// anchor to (_storyboardId, blockId) exactly like the Review Center. This is a
// second entry point to the SAME data, not a new store. There is no @mention
// backend, so "@ Mention" is a lightweight affordance that inserts "@".

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, RotateCcw, Trash2, CornerDownRight, AtSign } from 'lucide-react';
import type { StoryboardComment } from '@/api/adaptAuthoring';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function CommentPopover({
  blockId,
  blockLabel,
  courseId,
  comments,
  loading,
  onAdd,
  onResolve,
  onDelete,
  onClose,
}: {
  blockId: string | null;
  blockLabel: string;
  courseId?: string;
  comments: StoryboardComment[];
  loading?: boolean;
  onAdd: (blockId: string, body: string, courseId?: string, parentId?: string) => Promise<void>;
  onResolve: (commentId: string, resolved: boolean) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [body, setBody] = useState('');
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Only comments on the active block, threaded (top-level + replies).
  const { tops, repliesOf } = useMemo(() => {
    const forBlock = comments.filter((c) => c.blockId === blockId);
    const t = forBlock.filter((c) => !c._parentCommentId);
    const repliesOf = (id: string) =>
      forBlock
        .filter((c) => c._parentCommentId === id)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return { tops: t, repliesOf };
  }, [comments, blockId]);

  const post = async () => {
    if (!blockId || !body.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(blockId, body, courseId);
      setBody('');
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (parentId: string) => {
    if (!blockId || !reply?.text.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(blockId, reply.text, courseId, parentId);
      setReply(null);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-start justify-center bg-black/20 pt-24" onMouseDown={onClose}>
      <div
        className="w-[min(92vw,420px)] rounded-xl border bg-background p-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" title={blockLabel}>
            {blockLabel}
          </span>
          <button type="button" onClick={onClose} title="Close" className="ml-auto rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!blockId ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Place the cursor in a block to comment on it.
          </p>
        ) : (
          <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
            {tops.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
            {tops.map((top) => (
              <div key={top._id} className="rounded-lg border p-2.5">
                <div className="mb-1 flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">{timeAgo(top.createdAt)}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      title={top.resolved ? 'Reopen' : 'Resolve'}
                      onClick={() => onResolve(top._id, !top.resolved)}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
                    >
                      {top.resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => onDelete(top._id)}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{top.body}</p>

                {repliesOf(top._id).map((r) => (
                  <div key={r._id} className="mt-2 flex gap-1.5 border-l-2 border-border pl-2">
                    <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm text-foreground">{r.body}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
                    </div>
                  </div>
                ))}

                {!top.resolved &&
                  (reply?.id === top._id ? (
                    <form
                      className="mt-2 flex gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void sendReply(top._id);
                      }}
                    >
                      <input
                        autoFocus
                        value={reply.text}
                        onChange={(e) => setReply({ id: top._id, text: e.target.value })}
                        placeholder="Reply…"
                        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                      />
                      <button type="submit" disabled={!reply.text.trim() || busy} className="text-xs font-medium text-primary disabled:opacity-40">
                        Reply
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReply({ id: top._id, text: '' })}
                      className="mt-1.5 text-xs font-medium text-primary"
                    >
                      Reply
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* Compose */}
        {blockId && (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void post();
              }}
              placeholder="Comment... use @ to mention"
              rows={2}
              className="mb-2 w-full resize-y rounded-lg bg-muted/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBody((b) => `${b}@`)}
                title="Mention someone"
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-secondary"
              >
                <AtSign className="h-3.5 w-3.5" /> Mention
              </button>
              <button
                type="button"
                onClick={() => void post()}
                disabled={!body.trim() || busy}
                className="ml-auto rounded-md px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--primary)' }}
              >
                Post
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
