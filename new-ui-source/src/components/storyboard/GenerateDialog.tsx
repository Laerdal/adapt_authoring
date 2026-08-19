// Generate-course dialog (ADAPT-3760, Phase 4 / AC11).
// Shows a pre-generation validation report + plan summary, then the result.

import { Loader2, X, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { GenerationPlan, GenerationResult } from '@/api/storyboardGeneration';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={running ? undefined : onClose}>
      <div className="w-full max-w-lg rounded-lg border bg-background shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Generate Course</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={running}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {result ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[#166534]" />
              <p className="text-sm font-medium text-foreground">Course generated.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.created} created · {result.updated} updated · {result.deleted} removed
              </p>
            </div>
          ) : !plan ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing storyboard…
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                This will map your storyboard headings onto the Adapt course structure.
              </p>
              <div className="mb-3 grid grid-cols-4 gap-2">
                <Stat label="Topics" value={plan.topics} />
                <Stat label="Sections" value={plan.sections} />
                <Stat label="Groups" value={plan.groups} />
                <Stat label="Components" value={plan.components} />
              </div>

              {plan.willDelete > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-md border border-[#fcd34d] bg-[#fffbeb] p-2.5 text-sm text-[#92400e]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {plan.willDelete} existing course item(s) not present in the storyboard will be <b>removed</b>.
                  </span>
                </div>
              )}

              {plan.issues.map((msg, i) => (
                <div key={`i${i}`} className="mb-1.5 flex items-start gap-2 rounded-md border border-[#fca5a5] bg-[#fef2f2] p-2 text-sm text-[#991b1b]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {msg}
                </div>
              ))}
              {plan.warnings.slice(0, 5).map((msg, i) => (
                <div key={`w${i}`} className="mb-1.5 text-xs text-[#92400e]">
                  ⚠ {msg}
                </div>
              ))}
              {plan.warnings.length > 5 && (
                <div className="text-xs text-muted-foreground">…and {plan.warnings.length - 5} more.</div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-2.5">
          {result ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[color:var(--primary)] px-4 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={running}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!plan || blocked || running}
                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--primary)] px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
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
