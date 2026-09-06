// "Share for Review" — invite any active user from User Management as a
// reviewer. The full active-user roster (same set shown on the User
// Management page) is fetched once, then filtered locally as you type — a
// search-to-select picker rather than an always-visible checkbox list, which
// would be unusably long on production instances with 50+ users.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Loader2 } from 'lucide-react';
import { getActiveUsers, type UserSummary } from '@/api/adaptAuthoring';

const MAX_SUGGESTIONS = 8;

export default function ShareForReviewDialog({
  sharedWith,
  onShare,
  onClose,
}: {
  /** User ids currently shared with (from the storyboard record). */
  sharedWith: string[];
  onShare: (userIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserSummary[]>([]);
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const list = await getActiveUsers();
        if (cancelled) return;
        setUsers(list);
        const byId = new Map(list.map((u) => [u._id, u]));
        setSelected(sharedWith.map((id) => byId.get(id)).filter((u): u is UserSummary => !!u));
      } catch {
        if (!cancelled) setLoadError('Failed to load users. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedIds = new Set(selected.map((u) => u._id));
    const pool = users.filter((u) => !selectedIds.has(u._id));
    if (!q) return pool.slice(0, MAX_SUGGESTIONS);
    return pool
      .filter((u) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
        return u.email.toLowerCase().includes(q) || name.includes(q);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [users, query, selected]);

  const addReviewer = (user: UserSummary) => {
    setSelected((prev) => (prev.some((u) => u._id === user._id) ? prev : [...prev, user]));
    setQuery('');
    setShowSuggestions(false);
    setActiveIndex(-1);
    setError(null);
    inputRef.current?.focus();
  };

  const removeReviewer = (userId: string) => {
    setSelected((prev) => prev.filter((u) => u._id !== userId));
  };

  const handleShare = async () => {
    setSharing(true);
    setError(null);
    try {
      await onShare(selected.map((u) => u._id));
      onClose();
    } catch {
      setError('Failed to share the storyboard. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center pt-24"
      style={{ background: 'rgba(4, 30, 41, 0.35)' }}
      onMouseDown={onClose}
    >
      <div
        className="flex w-[min(92vw,440px)] flex-col p-4"
        style={{
          maxHeight: '70vh',
          borderRadius: 12,
          background: 'var(--life-color-bg-surface-default)',
          border: '1px solid var(--life-color-border-subtle)',
          boxShadow: 'var(--elevation-lg)',
          fontFamily: 'var(--font-family-primary)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: 'var(--life-color-text-subtle)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--life-color-text-default)' }}>
            Share for Review
          </span>
          <button type="button" onClick={onClose} title="Close" className="ml-auto sb-panel-collapse-btn">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3" style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>
          Search for anyone in User Management to invite as a reviewer.
        </p>

        <div className="relative mb-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
              setActiveIndex(0);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
            onKeyDown={(e) => {
              if (!showSuggestions || suggestions.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && activeIndex >= 0) {
                e.preventDefault();
                addReviewer(suggestions[activeIndex]);
              }
            }}
            placeholder={loading ? 'Loading users…' : 'Search by name or email…'}
            disabled={loading}
            className="w-full rounded px-2.5 py-1.5 outline-none"
            style={{
              fontSize: 13,
              border: '1px solid var(--life-color-border-subtle)',
              background: 'var(--life-color-bg-surface-default)',
              color: 'var(--life-color-text-default)',
            }}
          />
          {showSuggestions && !loading && (query.trim().length > 0 || suggestions.length > 0) && (
            <div
              role="listbox"
              aria-label="User suggestions"
              className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto"
              style={{
                borderRadius: 8,
                background: 'var(--life-color-bg-surface-default)',
                border: '1px solid var(--life-color-border-subtle)',
                boxShadow: 'var(--elevation-lg)',
              }}
            >
              {suggestions.length === 0 ? (
                <div className="px-3 py-2" style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>
                  No matching users.
                </div>
              ) : (
                suggestions.map((user, index) => {
                  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
                  const active = index === activeIndex;
                  return (
                    <button
                      key={user._id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addReviewer(user);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className="block w-full px-3 py-2 text-left"
                      style={{
                        background: active ? 'var(--life-color-bg-surface-subtle)' : 'none',
                        border: 'none',
                      }}
                    >
                      <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--life-color-text-default)' }}>
                        {user.email}
                      </span>
                      {name && (
                        <span className="block truncate" style={{ fontSize: 12, color: 'var(--life-color-text-subtle)' }}>
                          {name}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {loadError && (
          <p className="mb-2" style={{ fontSize: 12, color: 'var(--life-color-text-critical, #b42318)' }}>
            {loadError}
          </p>
        )}
        {error && (
          <p className="mb-2" style={{ fontSize: 12, color: 'var(--life-color-text-critical, #b42318)' }}>
            {error}
          </p>
        )}

        <div className="mb-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: '32vh' }}>
          {selected.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>Not shared with anyone yet.</p>
          ) : (
            selected.map((u) => (
              <div
                key={u._id}
                className="flex items-center gap-2 rounded px-2.5 py-1.5"
                style={{ border: '1px solid var(--life-color-border-subtle)' }}
              >
                <span className="flex-1 truncate" style={{ fontSize: 13, color: 'var(--life-color-text-default)' }}>
                  {u.email}
                </span>
                <button
                  type="button"
                  onClick={() => removeReviewer(u._id)}
                  aria-label={`Remove ${u.email}`}
                  className="sb-panel-collapse-btn"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="sb-toolbar-btn">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={sharing || loading}
            className="sb-toolbar-btn sb-toolbar-btn-primary"
          >
            {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Share
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
