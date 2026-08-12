// Right panel — "Review Center" (spec AC8/AC9).
//
// Storyboard summary + block-anchored comment threads (add / reply / resolve)
// + the audit/activity trail. Comments and audit come from the Phase 1 backend
// via useStoryboardReview. Comments anchor to block ids; a comment whose block
// no longer exists is shown as "(removed block)" rather than lost.

import { useState } from 'react';
import { PanelRightClose, MessageSquarePlus, Check, RotateCcw, Trash2, CornerDownRight } from 'lucide-react';
import type { StoryboardSummary } from '@/types/storyboard';
import type { StoryboardComment, StoryboardAuditEvent } from '@/api/adaptAuthoring';
import type { UseStoryboardReviewResult } from '@/hooks/useStoryboardReview';

type Tab = 'open' | 'resolved' | 'approvals' | 'activity';

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

interface CommentThreadProps {
  top: StoryboardComment;
  replies: StoryboardComment[];
  label: string;
  onReply: (parentId: string, blockId: string, body: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
}

function CommentThread({ top, replies, label, onReply, onResolve, onDelete }: CommentThreadProps) {
  const [reply, setReply] = useState('');
  return (
    <div className="rounded-lg border p-2.5">
      <div className="mb-1 flex items-center gap-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" title={label}>
          {label}
        </span>
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
      <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(top.createdAt)}</p>

      {replies.map((r) => (
        <div key={r._id} className="mt-2 flex gap-1.5 border-l-2 border-border pl-2">
          <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="whitespace-pre-wrap text-sm text-foreground">{r.body}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
          </div>
        </div>
      ))}

      {!top.resolved && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (reply.trim()) {
              onReply(top._id, top.blockId, reply);
              setReply('');
            }
          }}
        >
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply…"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
          />
          <button type="submit" disabled={!reply.trim()} className="text-xs font-medium text-primary disabled:opacity-40">
            Reply
          </button>
        </form>
      )}
    </div>
  );
}

interface ReviewCenterProps {
  summary: StoryboardSummary;
  review: UseStoryboardReviewResult;
  status: string;
  /** The block a new comment will anchor to (cursor position). */
  activeBlock?: { id: string; label: string };
  courseId?: string;
  /** Resolve a block id to a human label (heading text, etc.). */
  labelFor: (blockId: string) => string;
  onCollapse?: () => void;
}

export default function ReviewCenter({
  summary,
  review,
  status,
  activeBlock,
  courseId,
  labelFor,
  onCollapse,
}: ReviewCenterProps) {
  const [tab, setTab] = useState<Tab>('open');
  const [draft, setDraft] = useState('');

  const tops = review.comments.filter((c) => !c._parentCommentId);
  const repliesOf = (id: string) =>
    review.comments
      .filter((c) => c._parentCommentId === id)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  const openTops = tops.filter((c) => !c.resolved);
  const resolvedTops = tops.filter((c) => c.resolved);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'open', label: `Open (${review.openCount})` },
    { id: 'resolved', label: `Resolved (${review.resolvedCount})` },
    { id: 'approvals', label: 'Approvals' },
    { id: 'activity', label: 'Activity' },
  ];

  const addTopLevel = () => {
    if (!activeBlock || !draft.trim()) return;
    review.addComment(activeBlock.id, draft, courseId);
    setDraft('');
  };

  return (
    <aside className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Review Center</h2>
        {onCollapse && (
          <button
            type="button"
            aria-label="Collapse review center"
            onClick={onCollapse}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="border-b px-4 py-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Storyboard Summary
        </div>
        <SummaryRow label="Topics" value={summary.topics} />
        <SummaryRow label="Sections" value={summary.sections} />
        <SummaryRow label="Content items" value={summary.contentItems} />
        <SummaryRow label="Assets" value={summary.assets} />
        <SummaryRow label="Open Comments" value={review.openCount} />
        <SummaryRow label="Resolved" value={review.resolvedCount} />
        <SummaryRow label="Status" value={status.replace('_', ' ')} />
      </div>

      <div className="flex items-center gap-4 border-b px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 py-2 text-sm transition-colors ${
              tab === t.id
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {tab === 'open' && (
          <>
            <div className="rounded-lg border p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <MessageSquarePlus className="h-3.5 w-3.5" />
                {activeBlock ? `Comment on: ${activeBlock.label}` : 'Select a block to comment'}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                disabled={!activeBlock}
                className="w-full resize-y rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary disabled:opacity-50"
              />
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={addTopLevel}
                  disabled={!activeBlock || !draft.trim()}
                  className="rounded-md bg-[color:var(--primary)] px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Comment
                </button>
              </div>
            </div>

            {openTops.length === 0 ? (
              <p className="pt-2 text-center text-sm text-muted-foreground">No open comments.</p>
            ) : (
              openTops.map((c) => (
                <CommentThread
                  key={c._id}
                  top={c}
                  replies={repliesOf(c._id)}
                  label={labelFor(c.blockId)}
                  onReply={(parentId, blockId, body) => review.addComment(blockId, body, courseId, parentId)}
                  onResolve={review.setResolved}
                  onDelete={review.removeComment}
                />
              ))
            )}
          </>
        )}

        {tab === 'resolved' &&
          (resolvedTops.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No resolved comments yet.</p>
          ) : (
            resolvedTops.map((c) => (
              <CommentThread
                key={c._id}
                top={c}
                replies={repliesOf(c._id)}
                label={labelFor(c.blockId)}
                onReply={(parentId, blockId, body) => review.addComment(blockId, body, courseId, parentId)}
                onResolve={review.setResolved}
                onDelete={review.removeComment}
              />
            ))
          ))}

        {tab === 'approvals' && (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Current status: <span className="font-medium text-foreground">{status.replace('_', ' ')}</span>.
            <br />
            Use the status pill in the top bar to move Draft → In Review → Approved.
          </div>
        )}

        {tab === 'activity' &&
          (review.audit.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            review.audit.map((a: StoryboardAuditEvent) => (
              <div key={a._id} className="rounded-lg border p-2.5 text-sm">
                <span className="font-medium text-foreground">{a.event.replace('_', ' ')}</span>
                {a.fromStatus && a.toStatus && (
                  <span className="text-muted-foreground">
                    {' '}
                    — {a.fromStatus.replace('_', ' ')} → {a.toStatus.replace('_', ' ')}
                  </span>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(a.createdAt)}</p>
              </div>
            ))
          ))}
      </div>
    </aside>
  );
}
