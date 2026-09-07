// "Update content only" import mode (ADAPT-3760 import enhancements).
//
// Importing into a course that already has generated content must update
// ONLY content (heading text, component body/properties) and never touch
// structure (no created/removed/reordered pages, topics, sections, content
// groups, or components). This is DELIBERATELY simpler and safer than the
// full course-generation engine (storyboardGeneration.ts's
// generateStoryboardCourse) — that function's own header comment says it
// "updates + reparents + reorders" existing nodes to match a new tree, which
// is exactly the kind of structural churn this mode must never do.
//
// Instead this reuses `saveStoryboardToCourse` (adaptAuthoring.ts) — which
// ONLY ever PUTs title/body/properties onto already-existing content ids,
// never touching `_parentId`/`_sortOrder` — by matching imported content to
// existing content BY POSITION (Nth topic/section/group/component in the
// file <-> Nth in the live course) by walking both through the SAME tree
// parser used elsewhere (`parseDocToTree`), then building a small "patch"
// document of synthetic blocks carrying the EXISTING real ids with the
// IMPORTED content, and handing that to saveStoryboardToCourse as-is.
//
// Content in the imported file with no existing counterpart (the file has
// more topics/sections/groups/components than the course does) is
// deliberately NOT auto-created here — doing that safely without any risk of
// reordering already-matched siblings is significant additional complexity,
// and "never restructure existing content" is the stronger, explicitly
// requested guarantee. Such content is reported back so the caller can
// surface it (e.g. suggest Append mode) rather than silently dropping it.

import { getCourseStoryboardBlocks, saveStoryboardToCourse, BODY_SUFFIX, type CourseWriteBackResult } from "./adaptAuthoring";
import { parseDocToTree, type GenTopic, type GenSection, type GenGroup, type GenComponent } from "./storyboardGeneration";
import { isAssessmentComponentKind } from "./componentMapping";

export interface ContentOnlyUpdateResult extends CourseWriteBackResult {
  /** Imported topics/sections/groups/components with no existing counterpart
   *  at that position — not created, reported so the caller can decide. */
  unmatchedCounts: { topics: number; sections: number; groups: number; components: number };
}

function flattenComponentToText(comp: GenComponent): string {
  if (comp.componentKey === "text") return comp.body || "";
  if (comp.pendingKind === "groupedContent" && comp.pendingItems?.length) {
    return comp.pendingItems.map((it) => [it.title, it.body].filter(Boolean).join(": ")).join("\n");
  }
  return comp.body || comp.title || "";
}

/** Build the synthetic block(s) `saveStoryboardToCourse` needs to patch one
 * existing component's content, from the matched imported component. The
 * existing component's OWN kind is always kept — content is degraded to fit
 * it, never the other way around (never changes what type of component it is). */
function componentPatchBlocks(existingId: string, existingKind: string, imported: GenComponent): unknown[] {
  if (existingKind === "text") {
    const bodyText = flattenComponentToText(imported);
    return [
      { id: existingId, type: "heading", props: { level: 4 }, content: imported.title || "" },
      { id: `${existingId}${BODY_SUFFIX}`, type: "paragraph", content: bodyText },
    ];
  }
  if (imported.componentKey !== existingKind) {
    // No safe, generic way to map arbitrary content into this component's
    // shape — update the title only, leave its rich data alone.
    return [{ id: existingId, type: "heading", props: { level: 4 }, content: imported.title || "" }];
  }
  if (isAssessmentComponentKind(existingKind) && imported.assessmentData) {
    // Real question data (options/correct-flags/feedback/etc.) — not just
    // the title — flows through to saveStoryboardToCourse's sbAssessment
    // branch (ADAPT-3760: this was the missing half of the MCQ fix; the
    // OTHER half is the imported data actually surviving the DOCX round
    // trip at all, via the hidden per-card markers in documentConvert.js).
    return [
      {
        id: existingId,
        type: "sbAssessment",
        props: { kind: existingKind, title: imported.title || "", adaptComponent: existingKind, data: JSON.stringify(imported.assessmentData) },
      },
    ];
  }
  const data: Record<string, unknown> = { showTitle: false, description: imported.body || "", instruction: "" };
  if (imported.pendingKind === "image") data.image = imported.pendingImage;
  else if (imported.pendingKind === "video" || imported.pendingKind === "audio") data.media = imported.pendingMedia;
  else if (imported.pendingKind === "groupedContent") data.items = imported.pendingItems;
  return [
    {
      id: existingId,
      type: "sbComponent",
      props: { kind: existingKind, title: imported.title || "", adaptComponent: existingKind, data: JSON.stringify(data) },
    },
  ];
}

function headingPatchBlock(existingId: string, level: number, title: string): unknown {
  return { id: existingId, type: "heading", props: { level }, content: title };
}

interface WalkCounts { topics: number; sections: number; groups: number; components: number }

function walkGroups(
  existingGroups: GenGroup[],
  importedGroups: GenGroup[],
  patchBlocks: unknown[],
  unmatched: WalkCounts,
) {
  importedGroups.forEach((importedGroup, k) => {
    const existingGroup = existingGroups[k];
    if (!existingGroup) {
      unmatched.groups += 1;
      unmatched.components += importedGroup.components.length;
      return;
    }
    if (existingGroup.existingId && importedGroup.title && importedGroup.title !== existingGroup.title) {
      patchBlocks.push(headingPatchBlock(existingGroup.existingId, 3, importedGroup.title));
    }
    importedGroup.components.forEach((importedComp, l) => {
      const existingComp = existingGroup.components[l];
      if (!existingComp) {
        unmatched.components += 1;
        return;
      }
      if (existingComp.existingId) {
        patchBlocks.push(...componentPatchBlocks(existingComp.existingId, existingComp.componentKey, importedComp));
      }
    });
  });
}

function walkSections(
  existingSections: GenSection[],
  importedSections: GenSection[],
  patchBlocks: unknown[],
  unmatched: WalkCounts,
) {
  importedSections.forEach((importedSection, j) => {
    const existingSection = existingSections[j];
    if (!existingSection) {
      unmatched.sections += 1;
      importedSection.groups.forEach((g) => {
        unmatched.groups += 1;
        unmatched.components += g.components.length;
      });
      return;
    }
    if (existingSection.existingId && importedSection.title && importedSection.title !== existingSection.title) {
      patchBlocks.push(headingPatchBlock(existingSection.existingId, 2, importedSection.title));
    }
    walkGroups(existingSection.groups, importedSection.groups, patchBlocks, unmatched);
  });
}

function walkTopics(
  existingTopics: GenTopic[],
  importedTopics: GenTopic[],
  patchBlocks: unknown[],
  unmatched: WalkCounts,
) {
  importedTopics.forEach((importedTopic, i) => {
    const existingTopic = existingTopics[i];
    if (!existingTopic) {
      unmatched.topics += 1;
      importedTopic.sections.forEach((s) => {
        unmatched.sections += 1;
        s.groups.forEach((g) => {
          unmatched.groups += 1;
          unmatched.components += g.components.length;
        });
      });
      return;
    }
    if (existingTopic.existingId && importedTopic.title && importedTopic.title !== existingTopic.title) {
      patchBlocks.push(headingPatchBlock(existingTopic.existingId, 1, importedTopic.title));
    }
    walkSections(existingTopic.sections, importedTopic.sections, patchBlocks, unmatched);
  });
}

/**
 * Patch an existing course's content in place from imported blocks, matching
 * by position and never creating/deleting/reordering anything structural.
 */
export async function applyContentOnlyImport(courseId: string, importedBlocks: unknown[]): Promise<ContentOnlyUpdateResult> {
  const existingBlocks = await getCourseStoryboardBlocks(courseId);
  const existingTopics = parseDocToTree(existingBlocks, (id) => id); // ids are already real
  const importedTopics = parseDocToTree(importedBlocks, () => undefined);

  const patchBlocks: unknown[] = [];
  const unmatchedCounts: WalkCounts = { topics: 0, sections: 0, groups: 0, components: 0 };
  walkTopics(existingTopics, importedTopics, patchBlocks, unmatchedCounts);

  const writeBack = await saveStoryboardToCourse(courseId, patchBlocks);
  return { ...writeBack, unmatchedCounts };
}
