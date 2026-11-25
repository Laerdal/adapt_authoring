// The Course Setup choices of "Build with AI" and how they reach the model. Kept apart
// from the wizard component so the wording sent to Samaritan can be tested.

export type AudienceLevel = "beginner" | "intermediate" | "advanced";
export type CourseType = "knowledge" | "skills" | "compliance" | "assessment" | "awareness";
export type AssessmentLevel = "none" | "knowledge_check" | "formal";
export type InteractivityLevel = "minimal" | "moderate" | "high";
export type LearningExperience = "self_paced" | "instructor_led" | "blended";
export type CourseLength = "under_15" | "15_30" | "30_60" | "over_60";
// What Samaritan may draw on besides the description.
export type ContentSource = "sources_only" | "sources_plus_research";

export interface CourseSetup {
  audienceLevel: AudienceLevel;
  customAudience: string;
  courseType: CourseType;
  learningExperience: LearningExperience;
  courseLength: CourseLength;
  contentSource: ContentSource;
  assessmentLevel: AssessmentLevel;
  interactivityLevel: InteractivityLevel;
}

export const LENGTH_LABEL: Record<CourseLength, string> = {
  under_15: "Under 15 minutes",
  "15_30": "15-30 minutes",
  "30_60": "30-60 minutes",
  over_60: "Over 60 minutes"
};

// A rough size for the model to aim for; the author reviews the real plan before approving.
const LENGTH_SECTIONS: Record<CourseLength, string> = {
  under_15: "about 2-3 sections",
  "15_30": "about 3-5 sections",
  "30_60": "about 5-8 sections",
  over_60: "8 or more sections"
};

const EXPERIENCE_LABEL: Record<LearningExperience, string> = {
  self_paced: "self-paced",
  instructor_led: "instructor-led",
  blended: "blended (self-paced plus instructor-led)"
};

/**
 * The setup lines of the generation message. The description is the primary
 * instruction; the source material supports it, and is never blended in when it is
 * about something else.
 */
export function setupLines(s: CourseSetup, hasSources: boolean): string[] {
  const assessmentLabel = s.assessmentLevel === "formal" ? "Formal Assessment" : "Knowledge Check";
  const lines: string[] = [];

  lines.push(
    "The course description above is the primary instruction. If anything else here (a setting, or the source material) conflicts with it, follow the description."
  );
  if (hasSources) {
    lines.push(
      s.contentSource === "sources_only"
        ? "Content source: use ONLY the attached source material and the description. Do not add facts, figures or claims that are not in them. If the source material is about a different topic than the description, do not use it and say so in the assumptions."
        : "Content source: use the attached source material as the main basis and add accurate general knowledge where it has gaps. If the source material is about a different topic than the description, do not blend it in; follow the description and say so in the assumptions."
    );
  } else {
    lines.push("Content source: no source material was attached, so use accurate general knowledge about the description's topic and say so in the assumptions.");
  }

  const audience = s.customAudience.trim() ? `${s.audienceLevel} (${s.customAudience.trim()})` : s.audienceLevel;
  lines.push(
    `Course settings: Audience=${audience}, Course type=${s.courseType}, Learning experience=${EXPERIENCE_LABEL[s.learningExperience]}, Expected length=${LENGTH_LABEL[s.courseLength]} (${LENGTH_SECTIONS[s.courseLength]}).`
  );

  lines.push(
    s.interactivityLevel !== "minimal"
      ? `Interactivity=${s.interactivityLevel}: include one multiple-choice knowledge-check question (3-4 options, exactly one marked correct, brief per-option feedback) for each article.`
      : "Interactivity=minimal: do not include any multiple-choice questions."
  );
  lines.push(
    s.assessmentLevel !== "none"
      ? `Assessment=${assessmentLabel}: also include a final "${assessmentLabel}" page with multiple-choice questions covering the objectives.`
      : "Assessment=none: do not include a final assessment page."
  );
  return lines;
}
