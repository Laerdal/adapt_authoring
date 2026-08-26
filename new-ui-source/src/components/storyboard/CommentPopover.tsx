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
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center pt-24"
      style={{ background: 'rgba(4, 30, 41, 0.35)' }}
      onMouseDown={onClose}
    >
      <div
        className="w-[min(92vw,420px)] p-4"
        style={{
          borderRadius: 12,
          background: 'var(--life-color-bg-surface-default)',
          border: '1px solid var(--life-color-border-subtle)',
          boxShadow: 'var(--elevation-lg)',
          fontFamily: 'var(--font-family-primary)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <span
            className="truncate"
            title={blockLabel}
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--life-color-text-subtle)',
            }}
          >
            {blockLabel}
          </span>
          <button type="button" onClick={onClose} title="Close" className="ml-auto sb-panel-collapse-btn">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!blockId ? (
          <p className="mb-3" style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>
            Place the cursor in a block to comment on it.
          </p>
        ) : (
          <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
            {tops.length === 0 && !loading && (
              <p style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>No comments yet.</p>
            )}
            {tops.map((top) => (
              <div key={top._id} className="sb-card">
                <div className="mb-1 flex items-center gap-1">
                  <span style={{ fontSize: 11, color: 'var(--life-color-text-subtle)' }}>
                    {timeAgo(top.createdAt)}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      title={top.resolved ? 'Reopen' : 'Resolve'}
                      onClick={() => onResolve(top._id, !top.resolved)}
                      className="sb-panel-collapse-btn"
                    >
                      {top.resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => onDelete(top._id)}
                      className="sb-panel-collapse-btn"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p
                  className="whitespace-pre-wrap"
                  style={{ fontSize: 13, color: 'var(--life-color-text-default)' }}
                >
                  {top.body}
                </p>

                {repliesOf(top._id).map((r) => (
                  <div
                    key={r._id}
                    className="mt-2 flex gap-1.5 pl-2"
                    style={{ borderLeft: '2px solid var(--life-color-border-subtle)' }}
                  >
                    <CornerDownRight
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: 'var(--life-color-text-subtle)' }}
                    />
                    <div className="min-w-0">
                      <p
                        className="whitespace-pre-wrap"
                        style={{ fontSize: 13, color: 'var(--life-color-text-default)' }}
                      >
                        {r.body}
                      </p>
                      <p style={{ marginTop: 2, fontSize: 11, color: 'var(--life-color-text-subtle)' }}>
                        {timeAgo(r.createdAt)}
                      </p>
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
                        className="flex-1 rounded px-2 py-1 outline-none"
                        style={{
                          fontSize: 13,
                          border: '1px solid var(--life-color-border-subtle)',
                          background: 'var(--life-color-bg-surface-default)',
                          color: 'var(--life-color-text-default)',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!reply.text.trim() || busy}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--life-color-text-primary)',
                          opacity: reply.text.trim() && !busy ? 1 : 0.4,
                          background: 'none',
                          border: 'none',
                          cursor: reply.text.trim() && !busy ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Reply
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReply({ id: top._id, text: '' })}
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--life-color-text-primary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
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
              className="mb-2 w-full resize-y p-2.5 outline-none"
              style={{
                borderRadius: 'var(--radius)',
                background: 'var(--life-color-bg-surface-subtle)',
                border: '1px solid var(--life-color-border-subtle)',
                fontSize: 13,
                color: 'var(--life-color-text-default)',
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBody((b) => `${b}@`)}
                title="Mention someone"
                className="sb-toolbar-btn"
              >
                <AtSign className="h-3.5 w-3.5" /> Mention
              </button>
              <button
                type="button"
                onClick={() => void post()}
                disabled={!body.trim() || busy}
                className="ml-auto sb-toolbar-btn sb-toolbar-btn-primary"
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
