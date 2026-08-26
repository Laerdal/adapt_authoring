// Generate-course dialog (ADAPT-3760, Phase 4 / AC11, Figma-aligned ADAPT-3842).
// Shows a pre-generation validation report + plan summary, then the result.

import { Loader2, X, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { GenerationPlan, GenerationResult } from '@/api/storyboardGeneration';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="p-2 text-center"
      style={{
        border: '1px solid var(--life-color-border-subtle)',
        borderRadius: 'var(--radius)',
        background: 'var(--life-color-bg-surface-subtle)',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--life-color-text-default)' }}>{value}</div>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--life-color-text-subtle)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function GenerateDialog({
  plan,
  running,
  result,
  onConfirm,
  onClose,
}: {
  plan: GenerationPlan | null;
  running: boolean;
  result: GenerationResult | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const blocked = !!plan && plan.issues.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(4, 30, 41, 0.45)', fontFamily: 'var(--font-family-primary)' }}
      onClick={running ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg"
        style={{
          background: 'var(--life-color-bg-surface-default)',
          border: '1px solid var(--life-color-border-subtle)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--elevation-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--life-color-border-subtle)' }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--life-color-text-default)' }}>
            Generate Course
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={running}
            className="sb-panel-collapse-btn"
            style={{ opacity: running ? 0.4 : 1 }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {result ? (
            <div className="text-center">
              <CheckCircle2
                className="mx-auto mb-2 h-8 w-8"
                style={{ color: 'var(--life-color-text-positive)' }}
              />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--life-color-text-default)' }}>
                Course generated.
              </p>
              <p style={{ marginTop: 4, fontSize: 13, color: 'var(--life-color-text-subtle)' }}>
                {result.created} created · {result.updated} updated · {result.deleted} removed
              </p>
            </div>
          ) : !plan ? (
            <div
              className="flex items-center justify-center gap-2 py-8"
              style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing storyboard…
            </div>
          ) : (
            <>
              <p className="mb-3" style={{ fontSize: 13, color: 'var(--life-color-text-subtle)' }}>
                This will map your storyboard headings onto the Adapt course structure.
              </p>
              <div className="mb-3 grid grid-cols-4 gap-2">
                <Stat label="Topics" value={plan.topics} />
                <Stat label="Sections" value={plan.sections} />
                <Stat label="Groups" value={plan.groups} />
                <Stat label="Components" value={plan.components} />
              </div>

              {plan.willDelete > 0 && (
                <div
                  className="mb-3 flex items-start gap-2 p-2.5"
                  style={{
                    border: '1px solid var(--life-color-border-warning)',
                    background: 'var(--life-color-bg-surface-warning-subtle)',
                    color: 'var(--life-color-text-warning)',
                    borderRadius: 'var(--radius)',
                    fontSize: 13,
                  }}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {plan.willDelete} existing course item(s) not present in the storyboard will be <b>removed</b>.
                  </span>
                </div>
              )}

              {plan.issues.map((msg, i) => (
                <div
                  key={`i${i}`}
                  className="mb-1.5 flex items-start gap-2 p-2"
                  style={{
                    border: '1px solid var(--life-color-border-critical)',
                    background: 'var(--life-color-bg-surface-critical-subtle)',
                    color: 'var(--life-color-text-critical)',
                    borderRadius: 'var(--radius)',
                    fontSize: 13,
                  }}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {msg}
                </div>
              ))}
              {plan.warnings.slice(0, 5).map((msg, i) => (
                <div
                  key={`w${i}`}
                  className="mb-1.5"
                  style={{ fontSize: 12, color: 'var(--life-color-text-warning)' }}
                >
                  ⚠ {msg}
                </div>
              ))}
              {plan.warnings.length > 5 && (
                <div style={{ fontSize: 12, color: 'var(--life-color-text-subtle)' }}>
                  …and {plan.warnings.length - 5} more.
                </div>
              )}
            </>
          )}
        </div>

        <div
          className="flex justify-end gap-2 px-4 py-2.5"
          style={{ borderTop: '1px solid var(--life-color-border-subtle)' }}
        >
          {result ? (
            <button type="button" onClick={onClose} className="sb-toolbar-btn sb-toolbar-btn-primary">
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={running} className="sb-toolbar-btn">
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!plan || blocked || running}
                className="sb-toolbar-btn sb-toolbar-btn-primary"
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {running ? 'Generating…' : 'Generate'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
