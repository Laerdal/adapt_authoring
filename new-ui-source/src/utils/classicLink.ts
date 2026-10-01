// Maps the new UI's course routes to their classic-UI hash-route equivalents,
// so "Switch to Classic" lands on the same course/view instead of always the
// dashboard. Classic has no SPA route for /preview (frontend/src/modules/
// editor/global/views/editorView.js opens it via window.open instead), so
// preview falls back to the course's menu view.
const CLASSIC_ROUTE_BUILDERS: Record<string, (courseId: string) => string> = {
  menu: (courseId) => `editor/${courseId}/menu`,
  setup: (courseId) => `editor/${courseId}/settings`,
  storyboard: (courseId) => `storyboard/${courseId}`,
  preview: (courseId) => `editor/${courseId}/menu`,
};

export function toClassicUrl(pathname: string): string {
  const match = pathname.match(/^\/course\/([^/]+)(?:\/(setup|storyboard|preview))?\/?$/);
  if (!match || match[1] === "new") return "/classic";
  const [, courseId, subRoute] = match;
  const fragment = CLASSIC_ROUTE_BUILDERS[subRoute ?? "menu"](courseId);
  return `/classic#/${fragment}`;
}
