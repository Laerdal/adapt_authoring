// "Samaritan Assistance" AI popover for the storyboard.
//
// Functional parity with the legacy CKEditor "Samaritan Assistance" tool
// (frontend/src/modules/scaffold/backboneFormsOverrides.js): four fixed actions
// (Improve wording / Shorten / Prolong / Correct spelling) + a free-text prompt
// ("Ask Samaritan to edit or generate from scratch…"), then Insert / Replace /
// Try again / Dismiss. All AI runs through the server proxy (samaritanAssist →
// POST /api/storyboard/ai); no key is ever in the browser.
//
// Insert  → creates a NEW storyboard Text component (persists on Save).
// Replace → replaces the active block's content.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HeartHandshake, HelpCircle, X, RefreshCw, Send } from 'lucide-react';
import { samaritanAssist, type SamaritanAction } from '@/api/ai';

interface QuickAction {
  label: string;
  action: SamaritanAction;
}
const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Improve wording', action: 'improve' },
  { label: 'Shorten', action: 'shorten' },
  { label: 'Prolong', action: 'lengthen' },
  { label: 'Correct spelling', action: 'spelling' },
];

export default function AiAssistPopover({
  initialText = '',
  courseContext,
  onInsert,
  onReplace,
  onClose,
}: {
  initialText?: string;
  courseContext?: string;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState(initialText);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remember the last run so "Try again" can re-issue it.
  const lastRun = useRef<{ action: SamaritanAction; instruction?: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (action: SamaritanAction, instruction?: string) => {
    // Fixed actions operate on the content box; guide instead of 400ing when empty.
    if (action !== 'custom' && !content.trim()) {
      setError('Add or paste some content above first, or type an instruction below to generate from scratch.');
      return;
    }
    lastRun.current = { action, instruction };
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const out = (
        await samaritanAssist(action, content, { instruction, context: courseContext })
      ).trim();
      if (!out) {
        setError('Samaritan returned no content. Try again or refine your prompt.');
      } else {
        setResult(out);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitPrompt = () => {
    const instruction = prompt.trim();
    if (!instruction && !content.trim()) {
      setError('Enter a prompt or some content first.');
      return;
    }
    void run('custom', instruction);
  };

  const tryAgain = () => {
    if (lastRun.current) void run(lastRun.current.action, lastRun.current.instruction);
  };

  const canApply = !!result && !loading;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center pt-24"
      style={{ background: 'rgba(4, 30, 41, 0.35)' }}
      onMouseDown={onClose}
    >
      <div
        className="w-[min(92vw,520px)] p-5"
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
        <div className="mb-4 flex items-center gap-2">
          <HeartHandshake className="h-5 w-5" style={{ color: 'var(--samaritan)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--life-color-text-default)' }}>
            Samaritan Assistance
          </h3>
          <div
            className="ml-auto flex items-center gap-1"
            style={{ color: 'var(--life-color-text-subtle)' }}
          >
            <span title="Improve, shorten, prolong or spell-check the content, or type your own instruction.">
              <HelpCircle className="h-4 w-4" />
            </span>
            <button type="button" onClick={onClose} title="Close" className="sb-panel-collapse-btn">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content / result */}
        {result ? (
          <div
            className="mb-3 max-h-56 overflow-y-auto whitespace-pre-wrap p-3"
            style={{
              borderRadius: 'var(--radius)',
              border: '1px solid color-mix(in oklab, var(--samaritan) 30%, transparent)',
              background: 'linear-gradient(90deg, #FBDBFB 0%, #E0E6FA 100%)',
              fontSize: 13,
              color: 'var(--life-color-text-default)',
            }}
          >
            {result}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add your content here..."
            rows={4}
            disabled={loading}
            className="mb-3 w-full resize-y p-3 outline-none"
            style={{
              borderRadius: 'var(--radius)',
              background: 'var(--life-color-bg-surface-subtle)',
              border: '1px solid var(--life-color-border-subtle)',
              fontSize: 13,
              color: 'var(--life-color-text-default)',
              opacity: loading ? 0.6 : 1,
            }}
          />
        )}

        {loading && (
          <div className="mb-3" style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>
            Loading response from Samaritan…
          </div>
        )}
        {error && (
          <div className="mb-3" style={{ fontSize: 13, color: 'var(--life-color-text-critical)' }}>
            {error}
          </div>
        )}

        {/* Quick actions */}
        {!result && (
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.action}
                type="button"
                disabled={loading}
                onClick={() => void run(a.action)}
                className="sb-toolbar-btn"
                style={{ borderRadius: 9999, fontSize: 13 }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Free-text prompt */}
        <div
          className="mb-4 flex items-center gap-2 px-3 py-1.5"
          style={{
            borderRadius: 9999,
            border: '1px solid var(--life-color-border-subtle)',
            background: 'var(--life-color-bg-surface-default)',
          }}
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitPrompt();
            }}
            placeholder="Ask Samaritan to edit or generate from scratch..."
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ fontSize: 13, color: 'var(--life-color-text-default)', opacity: loading ? 0.6 : 1 }}
          />
          <button
            type="button"
            onClick={submitPrompt}
            disabled={loading}
            title="Send"
            className="sb-panel-collapse-btn"
            style={{ borderRadius: 9999 }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Footer: Try again · Dismiss · Replace · Insert */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={tryAgain}
            disabled={!lastRun.current || loading}
            title="Try again"
            className="sb-panel-collapse-btn"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="sb-toolbar-btn">
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                if (result) onReplace(result);
                onClose();
              }}
              disabled={!canApply}
              title="Replace the current block's content"
              className="sb-toolbar-btn"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                if (result) onInsert(result);
                onClose();
              }}
              disabled={!canApply}
              title="Insert the generated content"
              className="sb-toolbar-btn sb-toolbar-btn-primary"
            >
              Insert
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
