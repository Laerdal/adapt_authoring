import { describe, expect, it } from "vitest";
import { setupLines, type CourseSetup } from "./courseSetup";

const setup: CourseSetup = {
  audienceLevel: "beginner",
  customAudience: "",
  courseType: "knowledge",
  learningExperience: "self_paced",
  courseLength: "15_30",
  contentSource: "sources_only",
  assessmentLevel: "knowledge_check",
  interactivityLevel: "moderate"
};


describe("setupLines", () => {
  it("puts the description first and restricts a sources-only course to the sources", () => {
    const text = setupLines(setup, true).join("\n");
    expect(text).toMatch(/description above is the primary instruction/);
    expect(text).toMatch(/use ONLY the attached source material/);
    expect(text).toMatch(/different topic than the description, do not use it/);
  });

  it("allows general knowledge for sources + research, without blending an unrelated file", () => {
    const text = setupLines({ ...setup, contentSource: "sources_plus_research" }, true).join("\n");
    expect(text).toMatch(/add accurate general knowledge/);
    expect(text).toMatch(/do not blend it in/);
  });

  it("says so when no source was attached", () => {
    expect(setupLines(setup, false).join("\n")).toMatch(/no source material was attached/);
  });

  it("carries the audience, learning experience, length and custom audience", () => {
    const text = setupLines({ ...setup, audienceLevel: "intermediate", customAudience: "first-year nurses", learningExperience: "blended", courseLength: "30_60" }, false).join("\n");
    expect(text).toContain("Audience=intermediate (first-year nurses)");
    expect(text).toContain("Learning experience=blended");
    expect(text).toContain("Expected length=30-60 minutes");
  });

  it("keeps the interactivity and assessment instructions", () => {
    expect(setupLines(setup, false).join("\n")).toMatch(/Assessment=Knowledge Check/);
    expect(setupLines({ ...setup, interactivityLevel: "minimal", assessmentLevel: "none" }, false).join("\n")).toMatch(/do not include any multiple-choice/);
  });
});
