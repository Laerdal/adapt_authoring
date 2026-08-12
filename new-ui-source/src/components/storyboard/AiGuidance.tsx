// "AI guidance" box in the Contents panel (spec AC7).
//
// Heuristic, client-side instructional-design hints derived from the document
// summary — mirrors the reference design's suggestions. No LLM call yet; the
// server-side AI proxy (Phase 6) will deepen these.

import { Sparkles } from 'lucide-react';
import type { StoryboardSummary } from '@/types/storyboard';

function buildHints(summary: StoryboardSummary): string[] {
  const hints: string[] = [];
  const nonText = summary.contentItems - summary.textBlocks;
  if (summary.contentItems > 0 && nonText === 0) {
    hints.push('Mostly plain text. Suggested: Grouped Content or an Image.');
  }
  if (!summary.hasAssessment) {
    hints.push('No knowledge check yet. Suggested: add an MCQ.');
  }
  if (!summary.hasVisual) {
    hints.push('No visuals yet. Suggested: add an Image or Video.');
  }
  if (summary.topics === 0) {
    hints.push('No topics yet. Add an H1 heading to start a topic.');
  }
  return hints;
}

export default function AiGuidance({ summary }: { summary: StoryboardSummary }) {
  const hints = buildHints(summary);
  if (hints.length === 0) return null;

  return (
    <div className="rounded-lg border border-samaritan/30 bg-samaritan/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--samaritan)' }}>
        <Sparkles className="h-4 w-4" />
        AI guidance
      </div>
      <ul className="space-y-1.5 text-[13px] leading-snug text-muted-foreground">
        {hints.map((h, i) => (
          <li key={i}>• {h}</li>
        ))}
      </ul>
    </div>
  );
}
