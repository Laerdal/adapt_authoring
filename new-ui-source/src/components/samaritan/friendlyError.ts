// One place that turns what a failed request or file read throws into a sentence an
// author can act on. Raw library text (a JSZip message, a stack line, a URL) never
// reaches the screen; the technical detail stays in the console.

const GENERIC = "Something went wrong. Please try again.";

type Failure = { status?: number; message?: string };

function parts(err: unknown): { status?: number; raw: string } {
  const f = (err && typeof err === "object" ? err : {}) as Failure;
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : f.message ?? "";
  return { status: f.status, raw: String(raw || "") };
}

// Anything that reads like internals, not a message written for an author.
const LOOKS_TECHNICAL = /https?:\/\/|\bat [\w.<>]+ \(|\bTypeError\b|\bundefined\b|\bECONN|\bENOENT|jszip|central directory|\bJSON\b|\bunexpected token/i;

export function friendlyError(err: unknown, fallback = GENERIC): string {
  const { status, raw } = parts(err);
  const msg = raw.toLowerCase();

  if (/failed to fetch|networkerror|network request failed|load failed|err_network/.test(msg)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (status === 401) return "Your session has expired. Sign in again, then retry.";
  if (status === 403 || /not permitted|permission/.test(msg)) return "You don't have permission to do this in this course.";
  if (status === 409 || /already (been )?processed|duplicate/.test(msg)) {
    return "This has already been processed. Refresh the course to see the current state.";
  }
  if (status === 413 || /maximum upload size|too large/.test(msg)) return "That file is too large to upload.";
  if (status === 429) return "Samaritan is busy right now. Wait a moment and try again.";
  if (/ai.*(unavailable|not configured)|samaritan ai/.test(msg)) {
    return "Samaritan's AI service isn't available right now. Try again in a few minutes.";
  }
  if (status !== undefined && status >= 500) return "The server hit a problem. Try again, and tell support if it keeps happening.";

  if (raw && raw.length <= 220 && !LOOKS_TECHNICAL.test(raw)) return raw;
  return fallback;
}

/** A file that could not be read, worded for the kind of file it was. */
export function friendlyFileError(err: unknown, kind: string): string {
  const { raw } = parts(err);
  const msg = raw.toLowerCase();
  if (/central directory|zip|corrupt|damaged|password|could not be read|not a valid|invalid or unsupported|encrypted|end of data/.test(msg)) {
    return `This ${kind} file couldn't be opened. It may be damaged or password-protected. Open it, save a copy, and attach the copy.`;
  }
  if (/empty/.test(msg)) return `This ${kind} file is empty.`;
  if (/content type|unsupported file format|only \.docx/.test(msg)) {
    return "This file type isn't supported. Attach a Word (.docx), PDF or PowerPoint (.pptx) file.";
  }
  return friendlyError(err, `This ${kind} file couldn't be read. Try again, or use a different file.`);
}
