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
    <div
      className="flex items-center justify-between py-1"
      style={{ fontSize: 13, fontFamily: 'var(--font-family-primary)' }}
    >
      <span style={{ color: 'var(--life-color-text-subtle)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--life-color-text-default)' }}>{value}</span>
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
    <div className="sb-card" style={{ fontFamily: 'var(--font-family-primary)' }}>
      <div className="mb-1 flex items-center gap-2">
        <span
          className="truncate"
          title={label}
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--life-color-text-subtle)',
          }}
        >
          {label}
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
      <p style={{ marginTop: 2, fontSize: 11, color: 'var(--life-color-text-subtle)' }}>
        {timeAgo(top.createdAt)}
      </p>

      {replies.map((r) => (
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
            disabled={!reply.trim()}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--life-color-text-primary)',
              opacity: reply.trim() ? 1 : 0.4,
              background: 'none',
              border: 'none',
              cursor: reply.trim() ? 'pointer' : 'not-allowed',
            }}
          >
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
    <aside className="sb-panel" style={{ fontFamily: 'var(--font-family-primary)' }}>
      <div className="sb-panel-header">
        <h2 className="sb-panel-title">Review Center</h2>
        {onCollapse && (
          <button
            type="button"
            aria-label="Collapse review center"
            onClick={onCollapse}
            className="sb-panel-collapse-btn"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        className="px-4 py-3"
        style={{
          borderBottom: '1px solid var(--life-color-border-subtle)',
          background: 'var(--life-color-bg-surface-default)',
        }}
      >
        <div
          className="mb-1"
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--life-color-text-subtle)',
          }}
        >
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

      <div
        className="flex items-center gap-4 px-4"
        style={{
          borderBottom: '1px solid var(--life-color-border-subtle)',
          background: 'var(--life-color-bg-surface-default)',
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="-mb-px py-2"
              style={{
                fontSize: 13,
                fontFamily: 'var(--font-family-primary)',
                fontWeight: active ? 600 : 400,
                borderBottom: `2px solid ${active ? 'var(--life-color-border-primary)' : 'transparent'}`,
                color: active ? 'var(--life-color-text-default)' : 'var(--life-color-text-subtle)',
                background: 'none',
                cursor: 'pointer',
                transition: 'color 0.12s ease, border-color 0.12s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {tab === 'open' && (
          <>
            <div className="sb-card">
              <div
                className="mb-1 flex items-center gap-1.5"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--life-color-text-subtle)',
                }}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                {activeBlock ? `Comment on: ${activeBlock.label}` : 'Select a block to comment'}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                disabled={!activeBlock}
                className="w-full resize-y rounded px-2 py-1 outline-none"
                style={{
                  fontSize: 13,
                  border: '1px solid var(--life-color-border-subtle)',
                  background: 'var(--life-color-bg-surface-default)',
                  color: 'var(--life-color-text-default)',
                  opacity: activeBlock ? 1 : 0.5,
                }}
              />
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={addTopLevel}
                  disabled={!activeBlock || !draft.trim()}
                  className="sb-toolbar-btn sb-toolbar-btn-primary"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  Comment
                </button>
              </div>
            </div>

            {openTops.length === 0 ? (
              <p
                className="pt-2 text-center"
                style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}
              >
                No open comments.
              </p>
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
            <p
              className="text-center"
              style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}
            >
              No resolved comments yet.
            </p>
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
          <div
            className="p-4 text-center"
            style={{
              fontSize: 13,
              color: 'var(--life-color-text-subtle)',
              border: '1px dashed var(--life-color-border-subtle)',
              borderRadius: 'var(--radius)',
            }}
          >
            Current status:{' '}
            <span style={{ fontWeight: 600, color: 'var(--life-color-text-default)' }}>
              {status.replace('_', ' ')}
            </span>
            .<br />
            Use the status pill in the top bar to move Draft → In Review → Approved.
          </div>
        )}

        {tab === 'activity' &&
          (review.audit.length === 0 ? (
            <p
              className="text-center"
              style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}
            >
              No activity yet.
            </p>
          ) : (
            review.audit.map((a: StoryboardAuditEvent) => (
              <div key={a._id} className="sb-card" style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: 'var(--life-color-text-default)' }}>
                  {a.event.replace('_', ' ')}
                </span>
                {a.fromStatus && a.toStatus && (
                  <span style={{ color: 'var(--life-color-text-subtle)' }}>
                    {' '}
                    — {a.fromStatus.replace('_', ' ')} → {a.toStatus.replace('_', ' ')}
                  </span>
                )}
                <p style={{ marginTop: 2, fontSize: 11, color: 'var(--life-color-text-subtle)' }}>
                  {timeAgo(a.createdAt)}
                </p>
              </div>
            ))
          ))}
      </div>
    </aside>
  );
}
